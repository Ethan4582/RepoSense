import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import { indexGithubRepo } from "~/lib/github-loader";
import { pollCommits } from "~/lib/github";
import { indexingRoutes } from "./indexing";
import { commitsRoutes } from "./commits";
import { estimateRoutes } from "./estimate";
import { executeChatPipeline } from "./questions";

export const projectsRoutes = new Hono<AuthContext>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const projects = await db.project.findMany({
      where: {
        userToProjects: {
          some: {
            userId,
          },
        },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ projects });
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1, "Project name is required"),
        repoUrl: z.string().url("Invalid URL format").min(1, "Repository URL is required"),
        githubToken: z.string().optional(),
        chatProvider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"]).optional(),
        chatModel: z.string().optional(),
        embeddingProvider: z.enum(["GEMINI", "OPENAI"]).optional().default("GEMINI"),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const input = c.req.valid("json");

      const embeddingModel = input.embeddingProvider === "OPENAI" ? "text-embedding-3-small" : "gemini-embedding-001";
      const embeddingDimensions = input.embeddingProvider === "OPENAI" ? 1536 : 768;

      const project = await db.project.create({
        data: {
          name: input.name,
          repoUrl: input.repoUrl,
          gitHubToken: input.githubToken,
          chatProvider: input.chatProvider,
          chatModel: input.chatModel,
          embeddingProvider: input.embeddingProvider,
          embeddingModel,
          embeddingDimensions,
          userToProjects: {
            create: {
              userId,
            },
          },
        },
      });

      // Kick off background indexing & commits sync
      (async () => {
        try {
          await indexGithubRepo(
            input.repoUrl,
            input.githubToken ?? process.env.GITHUB_TOKEN,
            project.id
          );
          await pollCommits(project.id);
        } catch (err) {
          console.error("Project initial indexing error:", err);
        }
      })().catch(console.error);

      return c.json({ project });
    }
  )
  .get("/:id", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
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

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json({ project });
  })
  .patch("/:id/archive", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

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
      include: {
        user: true,
      },
    });

    return c.json({ members });
  })
  .get("/:id/questions", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    const questions = await db.question.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ questions });
  })
  .post(
    "/:id/questions",
    zValidator(
      "json",
      z.object({
        question: z.string().min(1),
        answers: z.string().min(1),
        fileReference: z.any().optional(),
      })
    ),
    async (c) => {
      const projectId = c.req.param("id");
      const userId = c.get("userId");
      const db = c.get("db");
      const { question, answers, fileReference } = c.req.valid("json");

      const saved = await db.question.create({
        data: {
          question,
          answers,
          fileReference: fileReference ?? null,
          projectId,
          userId,
        },
      });

      return c.json({ question: saved });
    }
  )
  .post(
    "/:id/chat",
    zValidator(
      "json",
      z.object({
        query: z.string().min(1),
        chatProvider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"]).optional(),
        chatModel: z.string().optional(),
        mode: z.enum(["rag", "simple"]).optional().default("rag"),
      })
    ),
    async (c) => {
      const projectId = c.req.param("id");
      const userId = c.get("userId");
      const { query, chatProvider, chatModel, mode } = c.req.valid("json");
      return await executeChatPipeline({
        c,
        projectId,
        userId,
        question: query,
        overrideProvider: chatProvider,
        overrideModel: chatModel,
        mode,
      });
    }
  )
  .route("/estimate", estimateRoutes)
  .route("/", commitsRoutes)
  .route("/", indexingRoutes);
