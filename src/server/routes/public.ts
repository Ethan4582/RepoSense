import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "~/server/db";
import { getFullFileContent } from "~/lib/embeddings";
import { cachedJson } from "~/lib/cache";
import { getProjectBranches } from "~/lib/branch";
import {
  parseRepoUrlRef,
  getRepoMetadata,
  GitHubAccessError,
} from "~/lib/github";
import { estimateRoutes } from "./estimate";

function plainSummary(markdown: string | undefined): string | null {
  if (!markdown) return null;
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_`~>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 280) : null;
}

export const publicRoutes = new Hono()
  .get("/explore", async (c) => {
    const rawQuery = c.req.query("q")?.trim().toLowerCase().slice(0, 120) ?? "";
    const query = rawQuery.length > 0 ? rawQuery : "all";

    return cachedJson(
      c,
      `explore-${query}`,
      async () => {
        const projects = await db.project.findMany({
          where: {
            isPublicWiki: true,
            deletedAt: null,
            lastIndexedAt: { not: null },
            ...(query !== "all"
              ? {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { repoOwner: { contains: query, mode: "insensitive" } },
                    { repoName: { contains: query, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { lastIndexedAt: "desc" },
          take: 60,
          select: {
            id: true,
            name: true,
            repoOwner: true,
            repoName: true,
            repoUrl: true,
            lastIndexedAt: true,
            lastIndexedCommitSha: true,
            defaultBranch: true,
            lastIndexedBranch: true,
            _count: { select: { wikiPages: true } },
            wikiPages: {
              where: { slug: "overview" },
              select: { content: true, branch: true },
              orderBy: { updatedAt: "desc" },
            },
          },
        });

        return {
          projects: projects.map((project) => {
            const overview =
              project.wikiPages.find(
                (page) =>
                  page.branch ===
                  (project.defaultBranch ?? project.lastIndexedBranch),
              ) ?? project.wikiPages[0];

            return {
              id: project.id,
              name: project.name,
              repoOwner: project.repoOwner,
              repoName: project.repoName,
              repoUrl: project.repoUrl,
              lastIndexedAt: project.lastIndexedAt,
              lastIndexedCommitSha: project.lastIndexedCommitSha,
              defaultBranch: project.defaultBranch,
              lastIndexedBranch: project.lastIndexedBranch,
              pageCount: project._count.wikiPages,
              summary: plainSummary(overview?.content),
            };
          }),
        };
      },
      60,
    );
  })
  .get("/projects/:id", async (c) => {
    const projectId = c.req.param("id");
    // Gate on current visibility before reading the edge cache so a wiki that
    // was just made private is never served from a stale entry.
    const visible = await db.project.findFirst({
      where: { id: projectId, isPublicWiki: true, deletedAt: null },
      select: { id: true, updatedAt: true },
    });
    if (!visible) return c.json({ error: "Wiki not found" }, 404);
    const version = visible.updatedAt.getTime();
    const branchKey = "default";

    return cachedJson(
      c,
      `public-project-${projectId}-${branchKey}-${version}`,
      async () => {
        const project = await db.project.findFirst({
          where: { id: projectId, isPublicWiki: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            repoOwner: true,
            repoName: true,
            repoUrl: true,
            lastIndexedAt: true,
            lastIndexedCommitSha: true,
            defaultBranch: true,
            lastIndexedBranch: true,
            chatModel: true,
            chatProvider: true,
            embeddingProvider: true,
          },
        });

        if (!project) throw new Error("Wiki not found");

        const activeBranch = project.defaultBranch ?? project.lastIndexedBranch;
        const branches = activeBranch
          ? (await getProjectBranches(db, projectId)).filter(
              (item) => item.branch === activeBranch,
            )
          : [];
        const wikiPages = activeBranch
          ? await db.wikiPage.findMany({
              where: { projectId, branch: activeBranch },
              orderBy: [{ sectionOrder: "asc" }, { pageOrder: "asc" }],
              select: {
                id: true,
                slug: true,
                title: true,
                sectionTitle: true,
                sectionOrder: true,
                pageOrder: true,
                headings: true,
              },
            })
          : [];

        return {
          project: { ...project, wikiPages, branches, activeBranch },
        };
      },
    ).catch(() => c.json({ error: "Wiki not found" }, 404));
  })
  .get("/wiki/:id", async (c) => {
    // Route alias for /api/public/wiki/[id] matching client requests
    const projectId = c.req.param("id");
    const visible = await db.project.findFirst({
      where: { id: projectId, isPublicWiki: true, deletedAt: null },
      select: { id: true, updatedAt: true },
    });
    if (!visible) return c.json({ error: "Wiki not found" }, 404);
    const version = visible.updatedAt.getTime();
    const branchKey = "default";

    return cachedJson(
      c,
      `public-project-${projectId}-${branchKey}-${version}`,
      async () => {
        const project = await db.project.findFirst({
          where: { id: projectId, isPublicWiki: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            repoOwner: true,
            repoName: true,
            repoUrl: true,
            lastIndexedAt: true,
            lastIndexedCommitSha: true,
            defaultBranch: true,
            lastIndexedBranch: true,
            chatModel: true,
            chatProvider: true,
            embeddingProvider: true,
          },
        });

        if (!project) throw new Error("Wiki not found");

        const activeBranch = project.defaultBranch ?? project.lastIndexedBranch;
        const branches = activeBranch
          ? (await getProjectBranches(db, projectId)).filter(
              (item) => item.branch === activeBranch,
            )
          : [];
        const wikiPages = activeBranch
          ? await db.wikiPage.findMany({
              where: { projectId, branch: activeBranch },
              orderBy: [{ sectionOrder: "asc" }, { pageOrder: "asc" }],
              select: {
                id: true,
                slug: true,
                title: true,
                sectionTitle: true,
                sectionOrder: true,
                pageOrder: true,
                headings: true,
              },
            })
          : [];

        return {
          project: { ...project, wikiPages, branches, activeBranch },
        };
      },
    ).catch(() => c.json({ error: "Wiki not found" }, 404));
  })
  .get("/projects/:id/pages/:slug", async (c) => {
    const projectId = c.req.param("id");
    const slug = c.req.param("slug");
    const visible = await db.project.findFirst({
      where: { id: projectId, isPublicWiki: true, deletedAt: null },
      select: {
        id: true,
        updatedAt: true,
        defaultBranch: true,
        lastIndexedBranch: true,
      },
    });
    if (!visible) return c.json({ error: "Page not found" }, 404);
    const version = visible.updatedAt.getTime();
    const branch = visible.defaultBranch ?? visible.lastIndexedBranch;
    const branchKey = branch ?? "default";

    return cachedJson(
      c,
      `public-page-${projectId}-${branchKey}-${slug}-${version}`,
      async () => {
        const page = await db.wikiPage.findFirst({
          where: {
            slug,
            projectId,
            ...(branch ? { branch } : {}),
            project: { isPublicWiki: true, deletedAt: null },
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                repoOwner: true,
                repoName: true,
                repoUrl: true,
                lastIndexedAt: true,
                lastIndexedCommitSha: true,
                defaultBranch: true,
                lastIndexedBranch: true,
              },
            },
          },
        });

        if (!page) throw new Error("Page not found");
        return { page };
      },
    ).catch(() => c.json({ error: "Page not found" }, 404));
  })
  .get("/projects/:id/file", async (c) => {
    const projectId = c.req.param("id");
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path is required" }, 400);
    if (filePath.length > 500) return c.json({ error: "File not found" }, 404);

    const project = await db.project.findFirst({
      where: { id: projectId, isPublicWiki: true, deletedAt: null },
      select: { id: true, defaultBranch: true, lastIndexedBranch: true },
    });
    if (!project) return c.json({ error: "Wiki not found" }, 404);

    const branch = project.defaultBranch ?? project.lastIndexedBranch;
    const content = await getFullFileContent(db, projectId, filePath, branch);
    if (content === null) return c.json({ error: "File not found" }, 404);

    return c.json({
      filePath,
      branch,
      content,
      lines: content.split("\n").length,
    });
  })
  .get("/projects/:id/questions/:questionId", async (c) => {
    const projectId = c.req.param("id");
    const questionId = c.req.param("questionId");

    const project = await db.project.findFirst({
      where: { id: projectId, isPublicWiki: true, deletedAt: null },
      select: { id: true },
    });
    if (!project) return c.json({ error: "Question not found" }, 404);

    const question = await db.question.findFirst({
      where: { id: questionId, projectId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, imageUrl: true },
        },
      },
    });

    if (!question) return c.json({ error: "Question not found" }, 404);
    return c.json({ question });
  })
  .route("/estimate", estimateRoutes)
  .post(
    "/verify-repo",
    zValidator(
      "json",
      z.object({
        repoUrl: z.string().min(1).max(500),
        githubToken: z.string().max(500).optional(),
      }),
    ),
    async (c) => {
      const { repoUrl, githubToken } = c.req.valid("json");

      let coordinates: ReturnType<typeof parseRepoUrlRef>;
      try {
        coordinates = parseRepoUrlRef(repoUrl);
      } catch (err) {
        return c.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Please enter a valid GitHub repository URL.",
          },
          400,
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
          err instanceof GitHubAccessError
            ? err.message
            : "Unable to access this GitHub repository.";
        return c.json(
          {
            error: message,
            code: err instanceof GitHubAccessError ? err.code : "GITHUB_ERROR",
          },
          400,
        );
      }
    },
  );
