import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import { encryptKeyWithIv } from "~/lib/providers";
import { alignChatModel, resolveProjectKeys } from "~/lib/providers/guard";
import { GitHubAccessError, decryptProjectToken, getRepoMetadata, parseRepoUrl } from "~/lib/github";
import { runIndexingWorkflow, inlineStepRunner } from "~/lib/indexing-workflow";
import { writesPaused } from "~/lib/emergency";
import { indexingRoutes } from "./indexing";
import { pullsRoutes } from "./pulls";
import { estimateRoutes } from "./estimate";
import { questionsRoutes } from "./questions";

const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"] as const;

const getEncryptionSecret = (): string =>
  process.env.ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const isEmergencyMode = () => writesPaused();

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

    return c.json({ projects });
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
          chatModel: alignChatModel(input.chatProvider, input.chatModel),
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

        runIndexingWorkflow({
          projectId: project.id,
          jobId: job.id,
          userId,
          step: inlineStepRunner,
          db,
        }).catch((err) => console.error("[projects] inline indexing failed:", err));
      } catch (err) {
        console.warn("[projects] indexing deferred:", err instanceof Error ? err.message : err);
      }

      return c.json({ project, indexingJobId }, 201);
    }
  )
  .get("/:id", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        wikiPages: {
          orderBy: [{ sectionOrder: "asc" }, { pageOrder: "asc" }],
        },
        userToProjects: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                emailAddress: true,
              },
            },
          },
        },
      },
    });

    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json({ project });
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
      isPublicWiki?: boolean;
      chatProvider?: (typeof PROVIDERS)[number];
      chatModel?: string;
    } = {};

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
    return c.json({ project: updated });
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

    return c.json({ project: updated });
  })
  .get("/:id/members", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

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
