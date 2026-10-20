import { Hono } from "hono";
import type { AuthContext } from "../auth";
import { indexGithubRepo } from "~/lib/github-loader";
import { pollCommits } from "~/lib/github";

export const indexingRoutes = new Hono<AuthContext>()
  .get("/:id/indexing/status", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const job = await db.indexingJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ job });
  })
  .post("/:id/indexing/start", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const job = await db.indexingJob.create({
      data: {
        projectId,
        status: "RUNNING",
        currentStep: "LOADING_REPO",
      },
    });

    // Run indexing asynchronously
    (async () => {
      try {
        await db.indexingJob.update({
          where: { id: job.id },
          data: { currentStep: "SUMMARIZING" },
        });

        await indexGithubRepo(
          project.repoUrl,
          project.gitHubToken ?? process.env.GITHUB_TOKEN,
          project.id
        );

        await db.indexingJob.update({
          where: { id: job.id },
          data: { currentStep: "COMMITS" },
        });

        await pollCommits(project.id);

        await db.indexingJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            currentStep: "DONE",
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Indexing failed";
        await db.indexingJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: msg,
          },
        });
      }
    })().catch(console.error);

    return c.json({ job });
  });
