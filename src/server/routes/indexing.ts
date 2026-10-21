import { Hono } from "hono";
import type { AuthContext } from "../auth";
import { runIndexingWorkflow, inlineStepRunner } from "~/lib/indexing-workflow";
import { resolveProjectKeys } from "~/lib/providers/guard";
import { GitHubAccessError, decryptProjectToken } from "~/lib/github";
import { writesPaused } from "~/lib/emergency";

export const indexingRoutes = new Hono<AuthContext>()
  .get("/:id/indexing/status", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Project not found" }, 404);

    const job = await db.indexingJob.findFirst({
      where: { projectId },
      orderBy: { startedAt: "desc" },
    });

    return c.json({ job });
  })
  .post("/:id/indexing/start", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");

    if (writesPaused()) {
      return c.json(
        {
          error:
            "Indexing is temporarily paused while the service is in emergency mode. Please try again later.",
          code: "EMERGENCY_MODE",
        },
        503
      );
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        userToProjects: { some: { userId } },
        deletedAt: null,
      },
    });

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const activeJobs = await db.indexingJob.count({
      where: {
        project: { userToProjects: { some: { userId } } },
        status: { in: ["QUEUED", "RUNNING"] },
      },
    });

    if (activeJobs >= 1) {
      return c.json(
        {
          error:
            "You already have a repository being indexed. Please wait for it to finish.",
          code: "INDEXING_IN_PROGRESS",
        },
        429
      );
    }

    const maxGlobalJobs = Number(process.env.MAX_GLOBAL_INDEXING_JOBS || 25);
    const runningJobs = await db.indexingJob.count({ where: { status: "RUNNING" } });

    if (Number.isFinite(maxGlobalJobs) && runningJobs >= maxGlobalJobs) {
      return c.json(
        {
          error:
            "The indexing queue is at capacity right now. Please try again in a few minutes.",
          code: "INDEXING_CAPACITY",
        },
        429
      );
    }

    try {
      await resolveProjectKeys(userId, project);
      await decryptProjectToken(project);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Missing API keys or GitHub token.";
      return c.json(
        {
          error: message,
          code: err instanceof GitHubAccessError ? err.code : "KEY_MISSING",
        },
        400
      );
    }

    const job = await db.indexingJob.create({
      data: {
        projectId,
        status: "QUEUED",
        currentStep: "LOADING_REPO",
        startedAt: new Date(),
      },
    });

    const workflow = (c.env as { INDEXING_WORKFLOW?: { create: (opts: { params: unknown }) => Promise<unknown> } } | undefined)
      ?.INDEXING_WORKFLOW;

    if (workflow) {
      const run = async () => {
        try {
          await workflow.create({
            params: { projectId, jobId: job.id, userId },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to start indexing workflow.";
          await db.indexingJob.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              errorCode: "WORKFLOW_START_FAILED",
              errorMessage: message,
              finishedAt: new Date(),
            },
          });
        }
      };

      try {
        c.executionCtx.waitUntil(run());
      } catch {
        await run();
      }
    } else {
      runIndexingWorkflow({
        projectId,
        jobId: job.id,
        userId,
        step: inlineStepRunner,
        db,
      }).catch((err) => console.error("[indexing] inline run failed:", err));
    }

    return c.json({ job });
  });
