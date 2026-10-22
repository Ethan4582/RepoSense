/**
 * BYOK access guard: ensures the acting user owns VALID keys for the exact
 * providers a project needs, and that model IDs match their provider.
 */

import {
  decryptKey,
  getDefaultChatModel,
  getDefaultEmbeddingModel,
  getEncryptionSecret,
  getModelInfo,
} from "~/lib/providers";
import type { EmbeddingProviderId, ProviderId } from "~/lib/providers";
import type { Project } from "@prisma/client";
import { db } from "~/server/db";

export class ProviderAccessError extends Error {
  readonly code:
    | "MISSING_CHAT_KEY"
    | "MISSING_EMBEDDING_KEY"
    | "MISSING_GITHUB_TOKEN"
    | "PROVIDER_MISMATCH";

  constructor(code: ProviderAccessError["code"], message: string) {
    super(message);
    this.name = "ProviderAccessError";
    this.code = code;
  }
}

export const EMBEDDING_DIMENSIONS: Record<EmbeddingProviderId, number> = {
  OPENAI: 1536,
  GEMINI: 768,
};

export async function getDecryptedProviderKey(
  userId: string,
  provider: ProviderId
): Promise<string | null> {
  const record = await db.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (record?.status !== "VALID") return null;

  try {
    return await decryptKey(
      { encryptedKey: record.encryptedKey, iv: record.iv },
      getEncryptionSecret()
    );
  } catch {
    return null;
  }
}

export function alignChatModel(provider: ProviderId, modelId?: string | null): string {
  if (!modelId) return getDefaultChatModel(provider);

  const info = getModelInfo(modelId);
  if (info?.provider !== provider) {
    return getDefaultChatModel(provider);
  }
  return modelId;
}

export function alignEmbeddingModel(
  provider: EmbeddingProviderId,
  modelId?: string | null
): string {
  if (!modelId) return getDefaultEmbeddingModel(provider);

  const info = getModelInfo(modelId);
  if (info?.provider !== provider || !info.isEmbedding) {
    return getDefaultEmbeddingModel(provider);
  }
  return modelId;
}

export interface ResolvedProjectKeys {
  chatProvider: ProviderId;
  chatModel: string;
  chatApiKey: string;
  embeddingProvider: EmbeddingProviderId;
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingApiKey: string;
}

export async function resolveProjectKeys(
  userId: string,
  project: Pick<Project, "chatProvider" | "chatModel" | "embeddingProvider" | "embeddingModel">
): Promise<ResolvedProjectKeys> {
  const chatProvider = project.chatProvider;
  const embeddingProvider = project.embeddingProvider;

  const [chatApiKey, embeddingApiKey] = await Promise.all([
    getDecryptedProviderKey(userId, chatProvider),
    getDecryptedProviderKey(userId, embeddingProvider),
  ]);

  if (!chatApiKey) {
    throw new ProviderAccessError(
      "MISSING_CHAT_KEY",
      `Add a valid ${chatProvider} API key in Settings to continue.`
    );
  }

  if (!embeddingApiKey) {
    throw new ProviderAccessError(
      "MISSING_EMBEDDING_KEY",
      `Add a valid ${embeddingProvider} API key in Settings to index this repository.`
    );
  }

  return {
    chatProvider,
    chatModel: alignChatModel(chatProvider, project.chatModel),
    chatApiKey,
    embeddingProvider,
    embeddingModel: alignEmbeddingModel(embeddingProvider, project.embeddingModel),
    embeddingDimensions: EMBEDDING_DIMENSIONS[embeddingProvider],
    embeddingApiKey,
  };
}

export async function getValidProviderIds(userId: string): Promise<ProviderId[]> {
  const keys = await db.apiKey.findMany({
    where: { userId, status: "VALID" },
    select: { provider: true },
  });
  return keys.map((k) => k.provider);
}
