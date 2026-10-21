import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { embed, generateText } from "ai";
import type { AuthContext } from "../auth";
import type { ProviderId } from "~/lib/providers";
import { decryptKey, getEmbeddingModel, getModel, getDefaultChatModel } from "~/lib/providers";
import { indexGithubRepo } from "~/lib/github-loader";

const getEncryptionSecret = (): string => {
  return process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
};

function extractGitHubUrl(text: string): string | null {
  const match = text.match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+/i);
  return match ? match[0] : null;
}

export async function executeChatPipeline(opts: {
  c: Context<AuthContext>;
  projectId: string;
  userId: string;
  question: string;
  overrideProvider?: ProviderId;
  overrideModel?: string;
  mode?: "rag" | "simple";
}) {
  const { c, projectId, userId, question, overrideProvider, overrideModel, mode = "rag" } = opts;
  const db = c.get("db");

  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const detectedRepoUrl = extractGitHubUrl(question);
  if (detectedRepoUrl && (!project.repoUrl || project.repoUrl === "https://github.com/placeholder/repo" || !project.repoUrl.includes("github.com"))) {
    db.project.update({
      where: { id: projectId },
      data: { repoUrl: detectedRepoUrl },
    }).catch(console.error);

    indexGithubRepo(
      detectedRepoUrl,
      project.gitHubToken ?? process.env.GITHUB_TOKEN,
      project.id
    ).catch((err) => console.error("[RAG Repo Ingest] Error:", err));
  }

  const provider = (overrideProvider || project.chatProvider || "OPENAI") as ProviderId;
  let modelId = overrideModel || project.chatModel;
  if (!modelId) {
    try {
      modelId = getDefaultChatModel(provider);
    } catch {
      modelId = provider === "OPENAI" ? "gpt-4o" : "gemini-2.5-flash";
    }
  }

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
  } else if (provider === "OPENAI" && process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY;
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

  if (mode === "simple") {
    console.log(`[Chat] Mode: Simple (Direct LLM) | Model: ${provider}/${modelId}`);
    const prompt = `You are an expert AI software engineer assisting a developer with programming and software engineering questions.\n\nQUESTION:\n${question}\n\nAnswer concisely, cleanly, and accurately using Markdown syntax with code blocks when relevant.`;
    
    try {
      const chatModel = getModel(provider, modelId, apiKey);
      const { text } = await generateText({
        model: chatModel as any,
        prompt,
      });

      if (keyRecord) {
        db.apiKey.update({
          where: { id: keyRecord.id },
          data: { lastUsedAt: new Date() },
        }).catch(console.error);
      }

      return c.json({
        answer: text,
        fileReferences: [] as any[],
      });
    } catch (err: any) {
      console.error("[Chat] Simple chat generation failed:", err);
      return c.json(
        {
          error: err?.message || "Failed to generate AI response. Please check your API key and connection.",
          code: "AI_GENERATION_FAILED",
        },
        500
      );
    }
  }

  // RAG Mode
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
    } else if (embProvider === "OPENAI" && process.env.OPENAI_API_KEY) {
      embKey = process.env.OPENAI_API_KEY;
    }
  }

  let matchedDocs: Array<{ fileName: string; sourceCode: string; summary: string; similarity: number }> = [];

  if (embKey) {
    console.log(`[RAG] Step 1/3: Embedding query with ${embProvider}...`);
    let embeddingVector: number[] | null = null;
    try {
      const embeddingModel = getEmbeddingModel(embProvider, project.embeddingModel, embKey);
      const { embedding } = await embed({
        model: embeddingModel as any,
        value: question,
      });
      embeddingVector = embedding;
    } catch (embErr) {
      console.error("[RAG] Step 1 failed (Embedding query):", embErr);
    }

    if (embeddingVector) {
      console.log(`[RAG] Step 2/3: Searching vector store...`);
      try {
        const vectorQuery = `[${embeddingVector.join(",")}]`;
        const vectorColumn = embProvider === "OPENAI" ? "summaryEmbeddingOpenAI" : "summaryEmbeddingGemini";

        matchedDocs = (await db.$queryRawUnsafe(
          `
          SELECT "fileName", "sourceCode", "summary",
          1 - ("${vectorColumn}" <=> $1::vector) AS similarity
          FROM "SourceCodeEmbedding"
          WHERE 1 - ("${vectorColumn}" <=> $1::vector) > 0.5
          AND "projectId" = $2
          ORDER BY similarity DESC
          LIMIT 10;
          `,
          vectorQuery,
          projectId
        )) as Array<{ fileName: string; sourceCode: string; summary: string; similarity: number }>;
        console.log(`[RAG] Step 2/3: Retrieved ${matchedDocs.length} matching code contexts`);
      } catch (searchErr) {
        console.error("[RAG] Step 2 failed (Vector search):", searchErr);
      }
    }
  }

  let prompt = "";
  if (matchedDocs.length > 0) {
    let context = "";
    for (const doc of matchedDocs) {
      context += `File: ${doc.fileName}\nSummary: ${doc.summary}\nCode:\n${doc.sourceCode}\n\n---\n\n`;
    }

    prompt = `You are an AI code assistant who answers questions about the codebase.\nSTART CONTEXT BLOCK\n${context}\nEND OF CONTEXT BLOCK\n\nSTART QUESTION\n${question}\nEND OF QUESTION\n\nAnswer the question clearly using Markdown syntax with code blocks when relevant. If the context does not provide sufficient info, state what is missing.`;
  } else {
    prompt = `You are an expert AI software engineer assisting a developer with general programming questions.\n\nQUESTION:\n${question}\n\nAnswer concisely and accurately using Markdown syntax with code blocks when relevant.`;
  }

  console.log(`[RAG] Step 3/3: Generating answer with ${provider}/${modelId}...`);
  try {
    const chatModel = getModel(provider, modelId, apiKey);
    const { text } = await generateText({
      model: chatModel as any,
      prompt,
    });

    if (keyRecord) {
      db.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      }).catch(console.error);
    }

    console.log(`[RAG] Complete: Generated answer (${matchedDocs.slice(0, 5).length} citations)`);

    return c.json({
      answer: text,
      fileReferences: matchedDocs.slice(0, 5),
    });
  } catch (err: any) {
    console.error("[RAG] Step 3 failed (Answer generation):", err);
    return c.json(
      {
        error: err?.message || "Failed to generate AI response. Please check your API key and connection.",
        code: "AI_GENERATION_FAILED",
      },
      500
    );
  }
}

export const questionsRoutes = new Hono<AuthContext>()
  .get("/:id/questions", async (c) => {
    const projectId = c.req.param("id")!;
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
      const projectId = c.req.param("id")!;
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
      const projectId = c.req.param("id")!;
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
  );
