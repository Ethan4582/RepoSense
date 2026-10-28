import { Hono } from "hono";
import type { AuthContext } from "../auth";
import { runIndexingWorkflow, inlineStepRunner } from "~/lib/indexing-workflow";
import { resolveProjectKeys } from "~/lib/providers/guard";
import {
  GitHubAccessError,
  decryptProjectToken,
  resolveRepoRef,
} from "~/lib/github";
import { writesPaused } from "~/lib/emergency";
import {
  checkIndexingCapacity,
  SERVER_BUSY_MESSAGE,
} from "~/lib/indexing-capacity";

export const indexingRoutes = new Hono<AuthContext>()
  .get("/:id/indexing/status", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");
    const branch = c.req.query("branch")?.trim();

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Project not found" }, 404);

    const job = await db.indexingJob.findFirst({
      where: { projectId, ...(branch ? { branch } : {}) },
      orderBy: { startedAt: "desc" },
    });

    return c.json({ job }, 200, { "Cache-Control": "no-store" });
  })
  .post("/:id/indexing/start", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");
    await c.req.json().catch(() => ({}));

    if (writesPaused()) {
      return c.json(
        {
          error:
            "Indexing is temporarily paused while the service is in emergency mode. Please try again later.",
          code: "EMERGENCY_MODE",
        },
        503,
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
      const retryAfterSeconds = 300;
      return c.json(
        {
          error: SERVER_BUSY_MESSAGE,
          code: "SERVER_BUSY",
          retryAfterSeconds,
          retryAt: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
        },
        503,
        { "Retry-After": String(retryAfterSeconds) },
      );
    }

    const capacity = await checkIndexingCapacity(db);
    if (!capacity.allowed) {
      return c.json(
        {
          error: SERVER_BUSY_MESSAGE,
          code: "SERVER_BUSY",
          retryAfterSeconds: capacity.retryAfterSeconds,
          retryAt: capacity.retryAt,
        },
        503,
        { "Retry-After": String(capacity.retryAfterSeconds) },
      );
    }

    let target: Awaited<ReturnType<typeof resolveRepoRef>>;
    try {
      await resolveProjectKeys(userId, project);
      const token = await decryptProjectToken(project);
      target = await resolveRepoRef(
        project.repoUrl,
        { branch: project.defaultBranch ?? undefined },
        token,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Missing API keys or GitHub token.";
      return c.json(
        {
          error: message,
          code: err instanceof GitHubAccessError ? err.code : "KEY_MISSING",
        },
        400,
      );
    }

    const completed = await db.indexingJob.findFirst({
      where: {
        projectId,
        branch: target.branch,
        commitSha: target.commitSha,
        status: "COMPLETED",
      },
      select: { id: true },
    });
    if (completed) {
      return c.json(
        {
          error: `The branch "${target.branch}" is already indexed at its latest commit.`,
          code: "BRANCH_ALREADY_INDEXED",
          branch: target.branch,
        },
        409,
      );
    }

    const job = await db.indexingJob.create({
      data: {
        projectId,
        branch: target.branch,
        branchKind: target.branchKind,
        pullRequestNumber: target.pullRequestNumber,
        commitSha: target.commitSha,
        status: "QUEUED",
        currentStep: "LOADING_REPO",
        startedAt: new Date(),
      },
    });

    const workflow = (
      c.env as
        | {
            INDEXING_WORKFLOW?: {
              create: (opts: { params: unknown }) => Promise<unknown>;
            };
          }
        | undefined
    )?.INDEXING_WORKFLOW;

    if (workflow) {
      const run = async () => {
        try {
          await workflow.create({
            params: { projectId, jobId: job.id, userId },
          });
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to start indexing workflow.";
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
      }).catch(() => {});
    }

    return c.json({ job });
  });
