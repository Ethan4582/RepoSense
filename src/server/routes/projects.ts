import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import { encryptKeyWithIv } from "~/lib/providers";
import { alignChatModel, resolveProjectKeys } from "~/lib/providers/guard";
import { GitHubAccessError, decryptProjectToken, getRepoMetadata, parseRepoUrl } from "~/lib/github";
import { getFullFileContent } from "~/lib/embeddings";
import { runIndexingWorkflow, inlineStepRunner } from "~/lib/indexing-workflow";
import { writesPaused } from "~/lib/emergency";
import { purgeWikiCache } from "~/lib/cache";
import { withoutProjectSecrets } from "~/lib/project";
import { indexingRoutes } from "./indexing";
import { pullsRoutes } from "./pulls";
import { estimateRoutes } from "./estimate";
import { questionsRoutes } from "./questions";

const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"] as const;

const getEncryptionSecret = (): string =>
  process.env.ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const isEmergencyMode = () => writesPaused();

async function purgeProjectWiki(db: AuthContext["Variables"]["db"], projectId: string) {
  const pages = await db.wikiPage.findMany({
    where: { projectId },
    select: { slug: true },
  });
  await purgeWikiCache(
    projectId,
    pages.map((page) => page.slug)
  );
}

export const projectsRoutes = new Hono<AuthContext>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const projects = await db.project.findMany({
      where: {
        userToProjects: { some: { userId } },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        indexingJobs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
        _count: { select: { wikiPages: true } },
      },
    });

    return c.json({ projects: projects.map(withoutProjectSecrets) });
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        repoUrl: z.string().url("Invalid URL format"),
        name: z.string().optional(),
        githubToken: z.string().optional(),
        chatProvider: z.enum(PROVIDERS).optional().default("OPENAI"),
        chatModel: z.string().optional(),
        embeddingProvider: z.enum(["OPENAI", "GEMINI"]).optional().default("OPENAI"),
        isPublicWiki: z.boolean().optional().default(true),
      })
    ),
    async (c) => {
      if (isEmergencyMode()) {
        return c.json(
          {
            error: "Repository indexing is temporarily paused. Please try again later.",
            code: "EMERGENCY_MODE",
          },
          503
        );
      }

      const userId = c.get("userId");
      const db = c.get("db");
      const input = c.req.valid("json");

      let coordinates: ReturnType<typeof parseRepoUrl>;
      try {
        coordinates = parseRepoUrl(input.repoUrl);
      } catch (err) {
        return c.json(
          {
            error: err instanceof Error ? err.message : "Invalid GitHub repository URL.",
            code: "INVALID_REPO_URL",
          },
          400
        );
      }

      let meta: Awaited<ReturnType<typeof getRepoMetadata>>;
      try {
        meta = await getRepoMetadata(coordinates.repoUrl, input.githubToken);
      } catch (err) {
        const message =
          err instanceof GitHubAccessError
            ? err.message
            : "Could not read this GitHub repository.";
        return c.json(
          {
            error: message,
            code: err instanceof GitHubAccessError ? err.code : "GITHUB_ERROR",
          },
          400
        );
      }

      const existing = await db.project.findFirst({
        where: {
          repoOwner: coordinates.owner,
          repoName: coordinates.repo,
          userToProjects: { some: { userId } },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existing) {
        return c.json(
          {
            error: "You have already added this repository.",
            code: "DUPLICATE_PROJECT",
            projectId: existing.id,
          },
          409
        );
      }

      let encryptedGithubToken: string | null = null;
      let githubTokenIv: string | null = null;

      if (input.githubToken?.trim()) {
        const encrypted = await encryptKeyWithIv(input.githubToken.trim(), getEncryptionSecret());
        encryptedGithubToken = encrypted.encryptedKey;
        githubTokenIv = encrypted.iv;
      }

      const embeddingModel =
        input.embeddingProvider === "OPENAI"
          ? "text-embedding-3-small"
          : "gemini-embedding-001";
      const embeddingDimensions = input.embeddingProvider === "OPENAI" ? 1536 : 768;
      const chatModel = alignChatModel(input.chatProvider, input.chatModel);

      try {
        await resolveProjectKeys(userId, {
          chatProvider: input.chatProvider,
          chatModel,
          embeddingProvider: input.embeddingProvider,
          embeddingModel,
        });
      } catch (err) {
        return c.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Add valid provider API keys in Settings before creating this wiki.",
          },
          400
        );
      }

      const project = await db.project.create({
        data: {
          name: `${coordinates.owner}/${coordinates.repo}`,
          repoOwner: coordinates.owner,
          repoName: coordinates.repo,
          repoUrl: coordinates.repoUrl,
          encryptedGithubToken,
          githubTokenIv,
          isPrivateRepo: meta.isPrivate,
          isPublicWiki: meta.isPrivate ? false : input.isPublicWiki,
          chatProvider: input.chatProvider,
          chatModel,
          embeddingProvider: input.embeddingProvider,
          embeddingModel,
          embeddingDimensions,
          userToProjects: { create: { userId } },
        },
      });

      let indexingJobId: string | null = null;

      try {
        await resolveProjectKeys(userId, project);
        await decryptProjectToken(project);

        const job = await db.indexingJob.create({
          data: {
            projectId: project.id,
            status: "QUEUED",
            currentStep: "LOADING_REPO",
            startedAt: new Date(),
          },
        });
        indexingJobId = job.id;

        const workflow = (
          c.env as
            | { INDEXING_WORKFLOW?: { create: (opts: { params: unknown }) => Promise<unknown> } }
            | undefined
        )?.INDEXING_WORKFLOW;

        if (workflow) {
          const run = async () => {
            try {
              await workflow.create({
                params: { projectId: project.id, jobId: job.id, userId },
              });
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Failed to start indexing workflow.";
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
            projectId: project.id,
            jobId: job.id,
            userId,
            step: inlineStepRunner,
            db,
          }).catch((err) => console.error("[projects] inline indexing failed:", err));
        }
      } catch (err) {
        console.warn("[projects] indexing deferred:", err instanceof Error ? err.message : err);
      }

      return c.json({ project: withoutProjectSecrets(project), indexingJobId }, 201);
    }
  )
  .post(
    "/verify-repo",
    zValidator("json", z.object({ repoUrl: z.string().min(1), githubToken: z.string().optional() })),
    async (c) => {
      const { repoUrl, githubToken } = c.req.valid("json");
      const db = c.get("db");

      let coordinates: ReturnType<typeof parseRepoUrl>;
      try {
        coordinates = parseRepoUrl(repoUrl);
      } catch (err) {
        return c.json(
          { error: err instanceof Error ? err.message : "Please enter a valid GitHub repository URL." },
          400
        );
      }

      try {
        const meta = await getRepoMetadata(coordinates.repoUrl, githubToken);
        const existingWiki = await db.project.findFirst({
          where: {
            repoOwner: { equals: coordinates.owner, mode: "insensitive" },
            repoName: { equals: coordinates.repo, mode: "insensitive" },
            isPublicWiki: true,
            deletedAt: null,
            lastIndexedAt: { not: null },
          },
          select: { id: true, name: true },
        });

        return c.json({
          repository: {
            owner: coordinates.owner,
            repo: coordinates.repo,
            name: `${coordinates.owner}/${coordinates.repo}`,
            defaultBranch: meta.defaultBranch,
            isPrivate: meta.isPrivate,
            sizeKb: meta.sizeKb,
            repoUrl: meta.repoUrl,
          },
          existingWiki,
        });
      } catch (err) {
        const message =
          err instanceof GitHubAccessError ? err.message : "Unable to access this GitHub repository.";
        return c.json(
          {
            error: message,
            code: err instanceof GitHubAccessError ? err.code : "GITHUB_ERROR",
          },
          400
        );
      }
    }
  )
  .get("/:id", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");
    const userId = c.get("userId");

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { isPublicWiki: true },
          { userToProjects: { some: { userId } } },
        ],
      },
      include: {
        wikiPages: {
          orderBy: [{ sectionOrder: "asc" }, { pageOrder: "asc" }],
        },
        userToProjects: { select: { userId: true } },
      },
    });

    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json({
      project: withoutProjectSecrets(project),
      isOwner: project.userToProjects.some((member) => member.userId === userId),
    });
  })
  .patch("/:id", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Project not found" }, 404);

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const data: {
      name?: string;
      isPublicWiki?: boolean;
      chatProvider?: (typeof PROVIDERS)[number];
      chatModel?: string;
    } = {};

    if (typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 120) {
      data.name = body.name.trim();
    }

    if (typeof body.isPublicWiki === "boolean") {
      data.isPublicWiki = project.isPrivateRepo ? false : body.isPublicWiki;
    }

    if (typeof body.chatProvider === "string" && (PROVIDERS as readonly string[]).includes(body.chatProvider)) {
      data.chatProvider = body.chatProvider as (typeof PROVIDERS)[number];
      data.chatModel = alignChatModel(data.chatProvider, body.chatModel);
    } else if (typeof body.chatModel === "string") {
      data.chatModel = alignChatModel(project.chatProvider, body.chatModel);
    }

    const updated = await db.project.update({ where: { id: projectId }, data });
    await purgeProjectWiki(db, projectId);
    return c.json({ project: withoutProjectSecrets(updated) });
  })
  .patch("/:id/archive", async (c) => {
    const projectId = c.req.param("id");
    const userId = c.get("userId");
    const db = c.get("db");

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Project not found" }, 404);

    const updated = await db.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });

    await purgeProjectWiki(db, projectId);
    return c.json({ project: withoutProjectSecrets(updated) });
  })
  .get("/:id/file", async (c) => {
    const projectId = c.req.param("id");
    const userId = c.get("userId");
    const db = c.get("db");
    const filePath = c.req.query("path");

    if (!filePath) return c.json({ error: "path is required" }, 400);

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Project not found" }, 404);

    const content = await getFullFileContent(db, projectId, filePath);
    if (content === null) return c.json({ error: "File not found" }, 404);

    return c.json({ filePath, content, lines: content.split("\n").length });
  })
  .get("/:id/members", async (c) => {
    const projectId = c.req.param("id");
    const userId = c.get("userId");
    const db = c.get("db");

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Project not found" }, 404);

    const members = await db.userToProject.findMany({
      where: { projectId },
      include: { user: true },
    });

    return c.json({ members });
  })
  .route("/estimate", estimateRoutes)
  .route("/", indexingRoutes)
  .route("/", pullsRoutes)
  .route("/", questionsRoutes);
