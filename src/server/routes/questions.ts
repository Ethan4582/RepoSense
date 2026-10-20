import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { embed, generateText } from "ai";
import type { AuthContext } from "../auth";
import type { ProviderId } from "~/lib/providers";
import { decryptKey, getEmbeddingModel, getModel } from "~/lib/providers";

const getEncryptionSecret = (): string => {
  return process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
};

export const questionsRoutes = new Hono<AuthContext>()
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
    "/:id/questions/ask",
    zValidator(
      "json",
      z.object({
        question: z.string().min(1),
        provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"]).optional(),
        modelId: z.string().optional(),
      })
    ),
    async (c) => {
      const projectId = c.req.param("id");
      const userId = c.get("userId");
      const db = c.get("db");
      const { question, provider: overrideProvider, modelId: overrideModel } = c.req.valid("json");

      const project = await db.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const provider = (overrideProvider || project.chatProvider || "GEMINI") as ProviderId;
      const modelId = overrideModel || project.chatModel || "gemini-2.5-flash";

      // Fetch user's decrypted API key for this provider
      const keyRecord = await db.apiKey.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

      let apiKey = "";
      if (keyRecord) {
        const secret = getEncryptionSecret();
        apiKey = await decryptKey({ encryptedKey: keyRecord.encryptedKey, iv: keyRecord.iv }, secret);
      } else if (provider === "GEMINI" && process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
      }

      if (!apiKey) {
        return c.json(
          {
            error: `No API key configured for ${provider}. Please add a key in Settings.`,
            code: "KEY_MISSING",
          },
          400
        );
      }

      // Generate embedding for query using project's embedding provider
      const embProvider = project.embeddingProvider === "OPENAI" ? "OPENAI" : "GEMINI";
      let embKey = apiKey;

      if (embProvider !== provider) {
        const embKeyRecord = await db.apiKey.findUnique({
          where: {
            userId_provider: {
              userId,
              provider: embProvider,
            },
          },
        });
        if (embKeyRecord) {
          const secret = getEncryptionSecret();
          embKey = await decryptKey({ encryptedKey: embKeyRecord.encryptedKey, iv: embKeyRecord.iv }, secret);
        } else if (embProvider === "GEMINI" && process.env.GEMINI_API_KEY) {
          embKey = process.env.GEMINI_API_KEY;
        }
      }

      const embeddingModel = getEmbeddingModel(embProvider, project.embeddingModel, embKey);
      const { embedding } = await embed({
        model: embeddingModel as any,
        value: question,
      });
      const vectorQuery = `[${embedding.join(",")}]`;

      // Dual vector similarity search
      const vectorColumn = embProvider === "OPENAI" ? "summaryEmbeddingOpenAI" : "summaryEmbeddingGemini";

      const matchedDocs = await db.$queryRawUnsafe<
        Array<{ fileName: string; sourceCode: string; summary: string; similarity: number }>
      >(
        `
        SELECT "fileName", "sourceCode", "summary",
        1 - ("${vectorColumn}" <=> $1::vector) AS similarity
        FROM "SourceCodeEmbedding"
        WHERE 1 - ("${vectorColumn}" <=> $1::vector) > 0.5
        AND "projectId" = $2
        ORDER BY similarity DESC
        LIMIT 12;
        `,
        vectorQuery,
        projectId
      );

      let context = "";
      for (const doc of matchedDocs) {
        context += `File: ${doc.fileName}\nSummary: ${doc.summary}\nCode:\n${doc.sourceCode}\n\n---\n\n`;
      }

      const prompt = `You are an AI code assistant who answers questions about the codebase.
START CONTEXT BLOCK
${context}
END OF CONTEXT BLOCK

START QUESTION
${question}
END OF QUESTION

Answer the question clearly using Markdown syntax with code blocks when relevant. If the context does not provide sufficient info, state what is missing.`;

      const chatModel = getModel(provider, modelId, apiKey);
      const { text } = await generateText({
        model: chatModel as any,
        prompt,
      });

      // Update key lastUsedAt
      if (keyRecord) {
        db.apiKey.update({
          where: { id: keyRecord.id },
          data: { lastUsedAt: new Date() },
        }).catch(console.error);
      }

      return c.json({
        answer: text,
        fileReferences: matchedDocs,
      });
    }
  );
