import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import { encryptKeyWithIv, getEncryptionSecret } from "~/lib/providers";
import { alignChatModel, resolveProjectKeys } from "~/lib/providers/guard";
import {
  GitHubAccessError,
  decryptProjectToken,
  getRepoMetadata,
  parseRepoUrl,
  parseRepoUrlRef,
  resolveRepoRef,
  getRepoGithubDetails,
} from "~/lib/github";
import { getFullFileContent } from "~/lib/embeddings";
import { runIndexingWorkflow, inlineStepRunner } from "~/lib/indexing-workflow";
import { writesPaused } from "~/lib/emergency";
import { purgeWikiCache } from "~/lib/cache";
import { withoutProjectSecrets } from "~/lib/project";
import { getProjectBranches, pickActiveBranch } from "~/lib/branch";
import { extractHeadings, extractCitationPaths } from "~/lib/chunker";
import { indexingRoutes } from "./indexing";
import { pullsRoutes } from "./pulls";
import { estimateRoutes } from "./estimate";
import { questionsRoutes } from "./questions";

const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"] as const;

const isEmergencyMode = () => writesPaused();

async function purgeProjectWiki(db: AuthContext["Variables"]["db"], projectId: string) {
  const pages = await db.wikiPage.findMany({
    where: { projectId },
    select: { slug: true, branch: true },
  });
  await purgeWikiCache(
    projectId,
    pages.map((page) => page.slug),
    Array.from(new Set(pages.map((page) => page.branch)))
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

    const enriched = await Promise.all(
      projects.map(async (p) => {
        const token = await decryptProjectToken(p).catch(() => null);
        const meta = await getRepoGithubDetails(p.repoOwner, p.repoName, token);
        return {
          ...withoutProjectSecrets(p),
          description: meta.description,
          stars: meta.stars,
          language: meta.language,
        };
      })
    );

    return c.json({ projects: enriched });
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        repoUrl: z.string().max(500).url("Invalid URL format"),
        name: z.string().max(120).optional(),
        githubToken: z.string().max(500).optional(),
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

      let coordinates: ReturnType<typeof parseRepoUrlRef>;
      try {
        coordinates = parseRepoUrlRef(input.repoUrl);
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

      let initialRef: Awaited<ReturnType<typeof resolveRepoRef>>;
      try {
        initialRef = await resolveRepoRef(
          coordinates.repoUrl,
          { branch: coordinates.branch },
          input.githubToken,
          meta
        );
      } catch (err) {
        return c.json(
          {
            error: err instanceof Error ? err.message : 'The requested GitHub branch could not be found.',
            code: err instanceof GitHubAccessError ? err.code : 'GITHUB_ERROR',
          },
          400
        );
      }

      const existing = await db.project.findFirst({
        where: {
          repoOwner: { equals: coordinates.owner, mode: "insensitive" },
          repoName: { equals: coordinates.repo, mode: "insensitive" },
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

      const activeJobs = await db.indexingJob.count({
        where: {
          project: { userToProjects: { some: { userId } } },
          status: { in: ["QUEUED", "RUNNING"] },
        },
      });

      if (activeJobs >= 1) {
        return c.json(
          {
            error: "You already have a repository being indexed. Please wait for it to finish.",
            code: "INDEXING_IN_PROGRESS",
          },
          429
        );
      }

      const maxGlobalJobs = Number(process.env.MAX_GLOBAL_INDEXING_JOBS ?? 25);
      const runningJobs = await db.indexingJob.count({ where: { status: "RUNNING" } });

      if (Number.isFinite(maxGlobalJobs) && runningJobs >= maxGlobalJobs) {
        return c.json(
          {
            error: "The indexing queue is at capacity right now. Please try again in a few minutes.",
            code: "INDEXING_CAPACITY",
          },
          429
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
          defaultBranch: meta.defaultBranch,
          lastIndexedBranch: initialRef.branch,
          lastIndexedBranchKind: initialRef.branchKind,
          lastIndexedCommitSha: initialRef.commitSha,
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
            branch: initialRef.branch,
            branchKind: initialRef.branchKind,
            pullRequestNumber: initialRef.pullRequestNumber,
            commitSha: initialRef.commitSha,
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
          }).catch(() => {});
        }
      } catch {
        // Indexing deferred
      }

      return c.json({ project: withoutProjectSecrets(project), indexingJobId }, 201);
    }
  )
  .post(
    "/verify-repo",
    zValidator(
      "json",
      z.object({
        repoUrl: z.string().min(1).max(500),
        githubToken: z.string().max(500).optional(),
      })
    ),
    async (c) => {
      const { repoUrl, githubToken } = c.req.valid("json");
      const db = c.get("db");

      let coordinates: ReturnType<typeof parseRepoUrlRef>;
      try {
        coordinates = parseRepoUrlRef(repoUrl);
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
          select: { id: true, name: true, lastIndexedBranch: true },
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
    const requestedBranch = c.req.query("branch")?.trim();

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
        userToProjects: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!project) return c.json({ error: "Project not found" }, 404);

    const branches = await getProjectBranches(db, projectId);
    const activeBranch = pickActiveBranch(requestedBranch, branches, project);
    const wikiPages = activeBranch
      ? await db.wikiPage.findMany({
          where: { projectId, branch: activeBranch },
          orderBy: [{ sectionOrder: "asc" }, { pageOrder: "asc" }],
        })
      : [];

    return c.json({
      project: withoutProjectSecrets({
        ...project,
        wikiPages,
        branches,
        activeBranch,
      }),
      isOwner: project.userToProjects.length > 0,
    });
  })
  .patch("/:id", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

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

    const requestedModel = typeof body.chatModel === "string" ? body.chatModel : undefined;

    if (typeof body.chatProvider === "string" && (PROVIDERS as readonly string[]).includes(body.chatProvider)) {
      data.chatProvider = body.chatProvider as (typeof PROVIDERS)[number];
      data.chatModel = alignChatModel(data.chatProvider, requestedModel);
    } else if (requestedModel) {
      data.chatModel = alignChatModel(project.chatProvider, requestedModel);
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
  .post(
    "/:id/pages",
    zValidator(
      "json",
      z.object({
        title: z.string().trim().min(1).max(200),
        sectionTitle: z.string().trim().max(100).optional(),
        content: z.string().default("# New Page\n\nWrite documentation here..."),
        branch: z.string().optional(),
      })
    ),
    async (c) => {
      const projectId = c.req.param("id");
      const userId = c.get("userId");
      const db = c.get("db");
      const body = c.req.valid("json");

      const member = await db.userToProject.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { id: true },
      });
      if (!member) return c.json({ error: "Unauthorized" }, 403);

      const project = await db.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { defaultBranch: true, lastIndexedBranch: true },
      });
      if (!project) return c.json({ error: "Project not found" }, 404);

      const targetBranch =
        body.branch?.trim() || project.lastIndexedBranch || project.defaultBranch || "main";

      let baseSlug = body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!baseSlug) baseSlug = "page";

      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await db.wikiPage.findUnique({
          where: {
            projectId_branch_slug: {
              projectId,
              branch: targetBranch,
              slug,
            },
          },
          select: { id: true },
        });
        if (!existing) break;
        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      const sectionTitle = body.sectionTitle?.trim() || "Documentation";
      const existingInSection = await db.wikiPage.findFirst({
        where: { projectId, branch: targetBranch, sectionTitle },
        orderBy: { pageOrder: "desc" },
        select: { sectionOrder: true, pageOrder: true },
      });

      let sectionOrder = 0;
      let pageOrder = 0;

      if (existingInSection) {
        sectionOrder = existingInSection.sectionOrder;
        pageOrder = existingInSection.pageOrder + 1;
      } else {
        const highestSection = await db.wikiPage.findFirst({
          where: { projectId, branch: targetBranch },
          orderBy: { sectionOrder: "desc" },
          select: { sectionOrder: true },
        });
        sectionOrder = highestSection ? highestSection.sectionOrder + 1 : 0;
        pageOrder = 0;
      }

      const headings = extractHeadings(body.content);
      const relevantFiles = extractCitationPaths(body.content);

      const newPage = await db.wikiPage.create({
        data: {
          projectId,
          branch: targetBranch,
          slug,
          title: body.title,
          sectionTitle,
          sectionOrder,
          pageOrder,
          content: body.content,
          relevantFiles,
          headings,
        },
      });

      await purgeWikiCache(projectId, [slug], [targetBranch]);
      return c.json({ page: newPage }, 201);
    }
  )
  .patch(
    "/:id/pages/reorder",
    zValidator(
      "json",
      z.object({
        pages: z.array(
          z.object({
            id: z.string(),
            sectionTitle: z.string().optional(),
            sectionOrder: z.number().int(),
            pageOrder: z.number().int(),
          })
        ),
      })
    ),
    async (c) => {
      const projectId = c.req.param("id");
      const userId = c.get("userId");
      const db = c.get("db");
      const body = c.req.valid("json");

      const member = await db.userToProject.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { id: true },
      });
      if (!member) return c.json({ error: "Unauthorized" }, 403);

      await db.$transaction(
        body.pages.map((item) =>
          db.wikiPage.update({
            where: { id: item.id },
            data: {
              ...(item.sectionTitle ? { sectionTitle: item.sectionTitle } : {}),
              sectionOrder: item.sectionOrder,
              pageOrder: item.pageOrder,
            },
          })
        )
      );

      await purgeWikiCache(projectId);
      return c.json({ success: true });
    }
  )
  .patch(
    "/:id/pages/:pageId",
    zValidator(
      "json",
      z.object({
        title: z.string().trim().min(1).max(200).optional(),
        sectionTitle: z.string().trim().max(100).optional(),
        content: z.string().optional(),
        sectionOrder: z.number().int().optional(),
        pageOrder: z.number().int().optional(),
      })
    ),
    async (c) => {
      const projectId = c.req.param("id");
      const pageId = c.req.param("pageId");
      const userId = c.get("userId");
      const db = c.get("db");
      const body = c.req.valid("json");

      const member = await db.userToProject.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { id: true },
      });
      if (!member) return c.json({ error: "Unauthorized" }, 403);

      const page = await db.wikiPage.findFirst({
        where: { id: pageId, projectId },
      });
      if (!page) return c.json({ error: "Page not found" }, 404);

      const updateData: {
        title?: string;
        sectionTitle?: string;
        sectionOrder?: number;
        pageOrder?: number;
        content?: string;
        headings?: ReturnType<typeof extractHeadings>;
        relevantFiles?: string[];
      } = {};

      if (body.title !== undefined) updateData.title = body.title;
      if (body.sectionTitle !== undefined) updateData.sectionTitle = body.sectionTitle;
      if (body.sectionOrder !== undefined) updateData.sectionOrder = body.sectionOrder;
      if (body.pageOrder !== undefined) updateData.pageOrder = body.pageOrder;
      if (body.content !== undefined) {
        updateData.content = body.content;
        updateData.headings = extractHeadings(body.content);
        updateData.relevantFiles = extractCitationPaths(body.content);
      }

      const updated = await db.wikiPage.update({
        where: { id: pageId },
        data: updateData,
      });

      await purgeWikiCache(projectId, [page.slug], [page.branch]);
      return c.json({ page: updated });
    }
  )
  .delete("/:id/pages/:pageId", async (c) => {
    const projectId = c.req.param("id");
    const pageId = c.req.param("pageId");
    const userId = c.get("userId");
    const db = c.get("db");

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Unauthorized" }, 403);

    const page = await db.wikiPage.findFirst({
      where: { id: pageId, projectId },
    });
    if (!page) return c.json({ error: "Page not found" }, 404);

    await db.wikiPage.delete({ where: { id: pageId } });
    await purgeWikiCache(projectId, [page.slug], [page.branch]);
    return c.json({ success: true, deletedId: pageId });
  })
  .get("/:id/file", async (c) => {
    const projectId = c.req.param("id");
    const userId = c.get("userId");
    const db = c.get("db");
    const filePath = c.req.query("path");
    const branchQuery = c.req.query("branch")?.trim();
    const branch = branchQuery === "" ? undefined : branchQuery;

    if (!filePath) return c.json({ error: "path is required" }, 400);
    if (filePath.length > 500) return c.json({ error: "File not found" }, 404);

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        userToProjects: { some: { userId } },
      },
      select: { defaultBranch: true, lastIndexedBranch: true },
    });
    if (!project) return c.json({ error: "Project not found" }, 404);

    const activeBranch = branch ?? project.lastIndexedBranch ?? project.defaultBranch;
    const content = await getFullFileContent(db, projectId, filePath, activeBranch);
    if (content === null) return c.json({ error: "File not found" }, 404);

    return c.json({
      filePath,
      branch: activeBranch,
      content,
      lines: content.split("\n").length,
    });
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
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    return c.json({ members });
  })
  .route("/estimate", estimateRoutes)
  .route("/", indexingRoutes)
  .route("/", pullsRoutes)
  .route("/", questionsRoutes);
