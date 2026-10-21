import { embed, generateText, streamText } from 'ai';
import type { PrismaClient, Project } from '@prisma/client';
import { getEmbeddingModel, getModel } from '~/lib/providers';
import { resolveProjectKeys, type ResolvedProjectKeys } from '~/lib/providers/guard';
import { searchCodeChunks, type MatchedChunk } from './embeddings';

export interface ScannedFileRange {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface QaAnswerResult {
  threadId: string;
  answer: string;
  scannedFiles: ScannedFileRange[];
  chunks: MatchedChunk[];
  modelUsed: string;
}

function uniqueScannedFiles(chunks: MatchedChunk[]): ScannedFileRange[] {
  const seen = new Set<string>();
  const result: ScannedFileRange[] = [];

  for (const chunk of chunks) {
    const key = chunk.filePath;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
    });
  }

  return result;
}

function buildPrompt(opts: {
  question: string;
  chunks: MatchedChunk[];
  wikiPages: Array<{ title: string; content: string }>;
}): string {
  const codeContext = opts.chunks
    .map(
      (chunk) =>
        `--- ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine}, similarity ${chunk.similarity?.toFixed?.(3) ?? 'n/a'}) ---\n${chunk.chunkContent}`
    )
    .join('\n\n');

  const wikiContext = opts.wikiPages
    .map((page) => `--- WIKI: ${page.title} ---\n${page.content.slice(0, 6000)}`)
    .join('\n\n');

  return `QUESTION:\n${opts.question}\n\nWIKI CONTEXT:\n${wikiContext || 'No matching wiki pages.'}\n\nSOURCE CODE CONTEXT:\n${codeContext || 'No matching source chunks.'}`;
}

const QA_SYSTEM_PROMPT = `You are DeepWiki, a senior codebase investigator. Answer the question using only the supplied wiki and source context.

Requirements:
- Explain precisely how the code works, referencing real files and functions.
- Every technical claim MUST include an inline citation in the format [[path/to/file.ext:startLine-endLine]].
- Only cite the exact files and line ranges present in the source context.
- Use clean Markdown, with short code snippets where they help.
- If the context is insufficient, say exactly what is missing instead of inventing behavior.`;

function resolveWikiPages(
  pages: Array<{ title: string; content: string }>,
  question: string
): Array<{ title: string; content: string }> {
  const terms = question
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);

  return pages
    .map((page) => {
      const haystack = `${page.title}\n${page.content}`.toLowerCase();
      const score = terms.reduce(
        (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
        0
      );
      return { page, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((entry) => entry.score > 0)
    .slice(0, 3)
    .map((entry) => entry.page);
}

export interface QaContext {
  db: PrismaClient;
  project: Project;
  userId: string;
  question: string;
  threadId?: string;
  keys?: ResolvedProjectKeys;
}

async function prepare(opts: QaContext) {
  const keys = opts.keys ?? (await resolveProjectKeys(opts.userId, opts.project));

  const embeddingModel = getEmbeddingModel(
    keys.embeddingProvider,
    keys.embeddingModel,
    keys.embeddingApiKey
  );
  const { embedding } = await embed({
    model: embeddingModel as never,
    value: opts.question,
    abortSignal: AbortSignal.timeout(30_000),
  });

  const chunks = await searchCodeChunks({
    db: opts.db,
    projectId: opts.project.id,
    provider: keys.embeddingProvider,
    embedding,
    limit: 12,
  });

  const allPages = await opts.db.wikiPage.findMany({
    where: { projectId: opts.project.id },
    select: { title: true, content: true },
    orderBy: [{ sectionOrder: 'asc' }, { pageOrder: 'asc' }],
    take: 40,
  });

  const wikiPages = resolveWikiPages(allPages, opts.question);
  let threadId = opts.threadId;

  if (threadId) {
    const thread = await opts.db.qaThread.findFirst({
      where: { id: threadId, userId: opts.userId, projectId: opts.project.id },
      select: { id: true },
    });
    if (!thread) threadId = undefined;
  }

  if (!threadId) {
    const thread = await opts.db.qaThread.create({
      data: {
        projectId: opts.project.id,
        userId: opts.userId,
        title: opts.question.slice(0, 120),
      },
      select: { id: true },
    });
    threadId = thread.id;
  }

  await opts.db.qaMessage.create({
    data: {
      threadId,
      role: 'user',
      content: opts.question,
      modelUsed: `${keys.chatProvider}/${keys.chatModel}`,
    },
  });

  const scannedFiles = uniqueScannedFiles(chunks);
  const prompt = buildPrompt({ question: opts.question, chunks, wikiPages });

  return {
    keys,
    threadId,
    chunks,
    scannedFiles,
    prompt,
  };
}

export async function answerQuestionOnce(opts: QaContext): Promise<QaAnswerResult> {
  const prepared = await prepare(opts);

  const { text } = await generateText({
    model: getModel(prepared.keys.chatProvider, prepared.keys.chatModel, prepared.keys.chatApiKey) as never,
    system: QA_SYSTEM_PROMPT,
    prompt: prepared.prompt,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(90_000),
  });

  await opts.db.qaMessage.create({
    data: {
      threadId: prepared.threadId,
      role: 'assistant',
      content: text,
      scannedFiles: prepared.scannedFiles as unknown as object,
      modelUsed: `${prepared.keys.chatProvider}/${prepared.keys.chatModel}`,
    },
  });

  await opts.db.qaThread.update({
    where: { id: prepared.threadId },
    data: { updatedAt: new Date() },
  });

  return {
    threadId: prepared.threadId,
    answer: text,
    scannedFiles: prepared.scannedFiles,
    chunks: prepared.chunks,
    modelUsed: prepared.keys.chatModel,
  };
}

export async function streamQuestion(
  opts: QaContext
): Promise<ReadableStream<Uint8Array>> {
  const prepared = await prepare(opts);
  const encoder = new TextEncoder();

  const send = (payload: unknown) =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(send({ type: 'thread', threadId: prepared.threadId }));

      for (const file of prepared.scannedFiles) {
        controller.enqueue(send({ type: 'scanning', ...file }));
      }

      controller.enqueue(
        send({
          type: 'meta',
          model: prepared.keys.chatModel,
          provider: prepared.keys.chatProvider,
        })
      );

      let fullText = '';

      try {
        const result = streamText({
          model: getModel(
            prepared.keys.chatProvider,
            prepared.keys.chatModel,
            prepared.keys.chatApiKey
          ) as never,
          system: QA_SYSTEM_PROMPT,
          prompt: prepared.prompt,
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(90_000),
        });

        for await (const delta of result.textStream) {
          if (!delta) continue;
          fullText += delta;
          controller.enqueue(send({ type: 'token', text: delta }));
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Answer generation failed.';
        controller.enqueue(send({ type: 'error', message }));
      }

      if (fullText) {
        await opts.db.qaMessage.create({
          data: {
            threadId: prepared.threadId,
            role: 'assistant',
            content: fullText,
            scannedFiles: prepared.scannedFiles as unknown as object,
            modelUsed: `${prepared.keys.chatProvider}/${prepared.keys.chatModel}`,
          },
        });

        await opts.db.qaThread.update({
          where: { id: prepared.threadId },
          data: { updatedAt: new Date() },
        });
      }

      controller.enqueue(send({ type: 'done', threadId: prepared.threadId }));
      controller.close();
    },
  });
}
