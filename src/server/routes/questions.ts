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

// Helper to detect if a query is purely general / conceptual rather than codebase specific
function isPurelyGeneralQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  // Question patterns like "what is ...", "how does ... work", "explain ..."
  const generalPatterns = [
    /^(what\s+is|what\s+are|define|explain)\s+(an?\s+)?([a-z0-9_-]+)(\?|\.|$)/i,
    /^(how\s+does|how\s+do)\s+([a-z0-9_-]+)\s+work(\?|\.|$)/i,
    /^(difference\s+between|compare)\s+/i,
    /^(what\s+does\s+([a-z0-9_-]+)\s+mean)/i,
    /^(why\s+use|when\s+to\s+use)\s+/i,
  ];

  // Specific code keywords that indicate the user wants this project's code
  const codebaseKeywords = [
    "this repo", "this project", "our code", "codebase", "this file", "in this app",
    "directory", "routes", "schema", "prisma", "components", "api", "endpoint",
    "src/", "package.json", "dockerfile", "readme", ".env", "index.ts"
  ];

  const hasCodebaseKeyword = codebaseKeywords.some((kw) => q.includes(kw));
  if (hasCodebaseKeyword) return false;

  return generalPatterns.some((pattern) => pattern.test(q));
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

  const isVirtualProject = projectId === "general" || projectId === "unlinked";
  let project = isVirtualProject
    ? null
    : await db.project.findUnique({
        where: { id: projectId },
      });

  if (!project && !isVirtualProject) {
    return c.json({ error: "Project not found" }, 404);
  }

  const projectName = project?.name ?? "General AI";

  const detectedRepoUrl = extractGitHubUrl(question);
  if (project && detectedRepoUrl && (!project.repoUrl || project.repoUrl === "https://github.com/placeholder/repo" || !project.repoUrl.includes("github.com"))) {
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

  const provider = (overrideProvider || project?.chatProvider || "OPENAI") as ProviderId;
  let modelId = overrideModel || project?.chatModel;
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

  // Check if project has valid repository or indexed vectors
  const hasRepoUrl = Boolean(
    project?.repoUrl &&
    project.repoUrl !== "https://github.com/placeholder/repo" &&
    project.repoUrl.includes("github.com")
  );

  const embeddingCount = isVirtualProject
    ? 0
    : await db.sourceCodeEmbedding.count({
        where: { projectId },
      });

  // Smart Query Routing:
  // If mode is simple, or if query is purely general/conceptual (e.g. "What is an ORM?"),
  // or if thread/project has no repository/embeddings, execute general conversational generation
  const isGeneralQuery = isPurelyGeneralQuery(question);
  const shouldBypassRAG = mode === "simple" || isGeneralQuery || !hasRepoUrl || embeddingCount === 0;

  if (shouldBypassRAG) {
    const isAntiHallucinationMode = mode === "simple" && hasRepoUrl && embeddingCount > 0;
    console.log(`[Chat] Smart Routing: Bypassing RAG (mode=${mode}, generalQuery=${isGeneralQuery}, hasRepo=${hasRepoUrl}, embeddings=${embeddingCount})`);

    const prompt = `You are a helpful, conversational AI assistant (ChatGPT style).

${
  isAntiHallucinationMode
    ? `IMPORTANT CONSTRAINTS & BEHAVIOR:
- You are currently in "General Chat Mode" (Direct conversational mode without codebase context).
- You DO NOT have access to any specific repository source code, files, branches, or PRs in this mode.
- If the user asks questions specifically about the project repository, its codebase architecture, specific files, functions, variables, commits, or implementation details of "${projectName}", DO NOT hallucinate, guess, or make up file contents or functions.
- Instead, politely inform the user:
  "I am currently in General Chat Mode without codebase context and do not have access to the repository files. Please switch to the **RAG** mode toggle on the chatbox to ask context-aware questions about the GitHub repository and codebase."`
    : `Answer the following question clearly, concisely, and accurately using Markdown syntax with formatted code blocks where appropriate.`
}

QUESTION:
${question}`;

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
      console.error("[Chat] Conversational generation failed:", err);
      return c.json(
        {
          error: err?.message || "Failed to generate AI response. Please check your API key and connection.",
          code: "AI_GENERATION_FAILED",
        },
        500
      );
    }
  }

  // RAG Mode with vector store search
  const embProvider = project?.embeddingProvider === "OPENAI" ? "OPENAI" : "GEMINI";
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
      const defaultEmbModel = embProvider === "OPENAI" ? "text-embedding-3-small" : "text-embedding-004";
      const embeddingModel = getEmbeddingModel(embProvider, project?.embeddingModel || defaultEmbModel, embKey);
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

    if (projectId === "general" || projectId === "unlinked") {
      return c.json({ questions: [] });
    }

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
        threadId: z.string().optional(),
        question: z.string().min(1),
        answers: z.string().min(1),
        fileReference: z.any().optional(),
        turns: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
              fileReferences: z.any().optional(),
              createdAt: z.string().or(z.date()).optional(),
            })
          )
          .optional(),
      })
    ),
    async (c) => {
      let projectId = c.req.param("id")!;
      const userId = c.get("userId");
      const db = c.get("db");
      const { threadId, question, answers, fileReference, turns } = c.req.valid("json");

      // Invariant thread persistence: if threadId already exists, update the thread's answers & turns
      if (threadId) {
        const existing = await db.question.findUnique({
          where: { id: threadId },
        });

        if (existing) {
          let updatedMetadata: any = existing.fileReference;
          if (turns && turns.length > 0) {
            updatedMetadata = { turns };
          } else if (Array.isArray(fileReference)) {
            updatedMetadata = fileReference;
          }

          const updated = await db.question.update({
            where: { id: threadId },
            data: {
              answers,
              fileReference: updatedMetadata,
              updatedAt: new Date(),
            },
          });
          return c.json({ question: updated });
        }
      }

      // If user is in unlinked/virtual project mode, resolve or find an existing project for them
      if (projectId === "general" || projectId === "unlinked") {
        const userProject = await db.project.findFirst({
          where: {
            userToProjects: {
              some: { userId },
            },
            deletedAt: null,
          },
          select: { id: true },
        });

        if (userProject) {
          projectId = userProject.id;
        } else {
          // Create default general workspace project if user has zero projects
          const defaultProject = await db.project.create({
            data: {
              name: "General Workspace",
              repoUrl: "https://github.com/placeholder/repo",
              userToProjects: {
                create: { userId },
              },
            },
          });
          projectId = defaultProject.id;
        }
      }

      const initialMetadata = turns && turns.length > 0 ? { turns } : (fileReference ?? null);

      const saved = await db.question.create({
        data: {
          question,
          answers,
          fileReference: initialMetadata,
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
