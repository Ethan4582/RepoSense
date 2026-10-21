import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import type { ProviderId } from "~/lib/providers";
import {
  ProviderAccessError,
  alignChatModel,
  getDecryptedProviderKey,
  resolveProjectKeys,
} from "~/lib/providers/guard";
import { answerQuestionOnce, streamQuestion } from "~/lib/qa-engine";
import { writesPaused } from "~/lib/emergency";

const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"] as const;

async function resolveKeys(
  userId: string,
  project: Parameters<typeof resolveProjectKeys>[1],
  overrideProvider?: ProviderId,
  overrideModel?: string
) {
  const keys = await resolveProjectKeys(userId, project);

  if (overrideProvider || overrideModel) {
    const provider = overrideProvider ?? keys.chatProvider;
    const apiKey =
      provider === keys.chatProvider
        ? keys.chatApiKey
        : await getDecryptedProviderKey(userId, provider);

    if (!apiKey) {
      throw new ProviderAccessError(
        "MISSING_CHAT_KEY",
        `Add a valid ${provider} API key in Settings to ask questions with this model.`
      );
    }

    keys.chatProvider = provider;
    keys.chatModel = alignChatModel(provider, overrideModel ?? keys.chatModel);
    keys.chatApiKey = apiKey;
  }

  return keys;
}

export const questionsRoutes = new Hono<AuthContext>()
  .get("/:id/qa/threads", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");

    const threads = await db.qaThread.findMany({
      where: { projectId, userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    });

    return c.json({ threads });
  })
  .get("/:id/qa/threads/:threadId", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("id");
    const threadId = c.req.param("threadId");

    const thread = await db.qaThread.findFirst({
      where: { id: threadId, projectId, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!thread) return c.json({ error: "Thread not found" }, 404);
    return c.json({ thread });
  })
  .post(
    "/:id/qa",
    zValidator(
      "json",
      z.object({
        question: z.string().min(1),
        threadId: z.string().optional(),
        chatProvider: z.enum(PROVIDERS).optional(),
        chatModel: z.string().optional(),
      })
    ),
    async (c) => {
      if (writesPaused()) {
        return c.json(
          {
            error:
              "High traffic mode: Reading existing Public & Private DeepWikis is active, new indexing is temporarily paused.",
            code: "READ_ONLY_MODE",
          },
          503
        );
      }

      const db = c.get("db");
      const userId = c.get("userId");
      const projectId = c.req.param("id");
      const { question, threadId, chatProvider, chatModel } = c.req.valid("json");

      const project = await db.project.findFirst({
        where: { id: projectId, deletedAt: null },
      });

      if (!project) return c.json({ error: "Project not found" }, 404);
      if (!project.isPublicWiki) {
        const member = await db.userToProject.findUnique({
          where: { userId_projectId: { userId, projectId } },
          select: { id: true },
        });
        if (!member) return c.json({ error: "Project not found" }, 404);
      }

      try {
        const keys = await resolveKeys(userId, project, chatProvider, chatModel);
        const stream = await streamQuestion({
          db,
          project,
          userId,
          question,
          threadId,
          keys,
        });

        return c.body(stream, 200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
      } catch (err) {
        if (err instanceof ProviderAccessError) {
          return c.json({ error: err.message, code: err.code }, 400);
        }
        const message = err instanceof Error ? err.message : "Failed to answer question.";
        return c.json({ error: message, code: "QA_FAILED" }, 500);
      }
    }
  )
  .post(
    "/:id/chat",
    zValidator(
      "json",
      z.object({
        query: z.string().min(1),
        chatProvider: z.enum(PROVIDERS).optional(),
        chatModel: z.string().optional(),
        threadId: z.string().optional(),
      })
    ),
    async (c) => {
      const db = c.get("db");
      const userId = c.get("userId");
      const projectId = c.req.param("id");
      const { query, chatProvider, chatModel, threadId } = c.req.valid("json");

      const project = await db.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          userToProjects: { some: { userId } },
        },
      });

      if (!project) return c.json({ error: "Project not found" }, 404);

      try {
        const keys = await resolveKeys(userId, project, chatProvider, chatModel);
        const result = await answerQuestionOnce({
          db,
          project,
          userId,
          question: query,
          threadId,
          keys,
        });

        return c.json({
          answer: result.answer,
          fileReferences: result.scannedFiles,
          threadId: result.threadId,
        });
      } catch (err) {
        if (err instanceof ProviderAccessError) {
          return c.json({ error: err.message, code: err.code }, 400);
        }
        const message = err instanceof Error ? err.message : "Failed to answer question.";
        return c.json({ error: message, code: "QA_FAILED" }, 500);
      }
    }
  )
  .get("/:id/questions", async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    if (projectId === "general" || projectId === "unlinked") {
      return c.json({ questions: [] });
    }

    const questions = await db.question.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, imageUrl: true },
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
      let projectId = c.req.param("id");
      const userId = c.get("userId");
      const db = c.get("db");
      const { question, answers, fileReference } = c.req.valid("json");

      if (projectId === "general" || projectId === "unlinked") {
        const userProject = await db.project.findFirst({
          where: { userToProjects: { some: { userId } }, deletedAt: null },
          select: { id: true },
        });

        if (userProject) {
          projectId = userProject.id;
        } else {
          const created = await db.project.create({
            data: {
              name: "General Workspace",
              repoOwner: "general",
              repoName: "workspace",
              repoUrl: "https://github.com/placeholder/repo",
              isPublicWiki: false,
              userToProjects: { create: { userId } },
            },
          });
          projectId = created.id;
        }
      }

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
  );
