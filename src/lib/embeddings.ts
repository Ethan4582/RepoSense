import { embedMany } from 'ai';
import type { PrismaClient } from '@prisma/client';
import { getEmbeddingModel } from '~/lib/providers';
import type { EmbeddingProviderId } from '~/lib/providers';
import type { CodeChunk } from './chunker';

const EMBEDDING_COLUMNS: Record<EmbeddingProviderId, string> = {
  OPENAI: 'embeddingOpenAI',
  GEMINI: 'embeddingGemini',
};

export interface MatchedChunk {
  id: string;
  filePath: string;
  directory: string;
  startLine: number;
  endLine: number;
  chunkContent: string;
  similarity: number;
}

export interface EmbeddingBatchOptions {
  db: PrismaClient;
  projectId: string;
  chunks: CodeChunk[];
  provider: EmbeddingProviderId;
  model: string;
  apiKey: string;
}

const EMBED_BATCH_SIZE = 100;

export async function embedAndStoreChunks(opts: EmbeddingBatchOptions): Promise<number> {
  const { db, projectId, chunks, provider, model, apiKey } = opts;
  if (chunks.length === 0) return 0;

  const embeddingModel = getEmbeddingModel(provider, model, apiKey);
  const column = EMBEDDING_COLUMNS[provider];
  let stored = 0;

  for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + EMBED_BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: embeddingModel as never,
      values: batch.map((chunk) => chunk.chunkContent),
    });

    const ids = batch.map(() => crypto.randomUUID());

    await db.sourceCodeEmbedding.createMany({
      data: batch.map((chunk, index) => ({
        id: ids[index]!,
        projectId,
        filePath: chunk.filePath,
        directory: chunk.directory,
        chunkIndex: chunk.chunkIndex,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        chunkContent: chunk.chunkContent,
        fullFileContent: chunk.fullFileContent ?? null,
      })),
    });

    const vectors = embeddings.map((embedding) => `[${embedding.join(',')}]`);

    await db.$executeRawUnsafe(
      `UPDATE "SourceCodeEmbedding" AS s
       SET "${column}" = v.emb::vector
       FROM unnest($1::text[], $2::text[]) AS v(id, emb)
       WHERE s."id" = v.id`,
      ids,
      vectors
    );

    stored += batch.length;
  }

  return stored;
}

export async function searchCodeChunks(opts: {
  db: PrismaClient;
  projectId: string;
  provider: EmbeddingProviderId;
  embedding: number[];
  limit?: number;
}): Promise<MatchedChunk[]> {
  const { db, projectId, provider, embedding, limit = 12 } = opts;
  const column = EMBEDDING_COLUMNS[provider];
  const vector = `[${embedding.join(',')}]`;

  return (await db.$queryRawUnsafe(
    `SELECT "id", "filePath", "directory", "startLine", "endLine", "chunkContent",
       1 - ("${column}" <=> $1::vector) AS similarity
     FROM "SourceCodeEmbedding"
     WHERE "projectId" = $2
       AND "${column}" IS NOT NULL
     ORDER BY "${column}" <=> $1::vector
     LIMIT $3`,
    vector,
    projectId,
    limit
  )) as MatchedChunk[];
}

export async function getFullFileContent(
  db: PrismaClient,
  projectId: string,
  filePath: string
): Promise<string | null> {
  const row = await db.sourceCodeEmbedding.findFirst({
    where: { projectId, filePath, chunkIndex: 0 },
    select: { fullFileContent: true },
  });
  return row?.fullFileContent ?? null;
}
