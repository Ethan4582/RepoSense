/**
 * RepoSense Gemini Provider Adapter
 *
 * Implements Google Gemini chat/reasoning models (Gemini 4 Argon, 3.1 Pro, etc.)
 * and embeddings (gemini-embedding-001 locked at 768 dimensions).
 * Reference identifier: GEMINI / gemini (never GOOGLE).
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getModelsByProvider } from './catalog';
import type { ModelInfo, VerifyResult } from './types';
import { performHttpKeyValidation } from './validation-helper';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiClient = ReturnType<typeof createGoogleGenerativeAI>;
export type GeminiChatModel = ReturnType<GeminiClient>;
export type GeminiEmbeddingModel = ReturnType<GeminiClient['textEmbeddingModel']>;

/**
 * Creates a Google Generative AI SDK client bound to the provided API key.
 */
export function getGeminiClient(apiKey: string): GeminiClient {
  return createGoogleGenerativeAI({
    apiKey: apiKey.trim(),
    baseURL: GEMINI_BASE_URL,
  });
}

/**
 * Resolves a chat/reasoning model instance for Gemini.
 */
export function getChatModel(modelId: string, apiKey: string): GeminiChatModel {
  const client = getGeminiClient(apiKey);
  return client(modelId);
}

/**
 * Resolves an embedding model for Gemini (gemini-embedding-001, 768 dims).
 */
export function getEmbeddingModel(
  modelId = 'gemini-embedding-001',
  apiKey: string
): GeminiEmbeddingModel {
  const client = getGeminiClient(apiKey);
  return client.textEmbeddingModel(modelId);
}

/**
 * Validates a Gemini API key against the v1beta/models endpoint with timeout.
 */
export async function validateKey(apiKey: string): Promise<VerifyResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: {
        name: 'ProviderError',
        code: 'INVALID_KEY',
        message: 'Gemini API key cannot be empty.',
      },
    };
  }

  return performHttpKeyValidation({
    url: `${GEMINI_BASE_URL}/models?key=${encodeURIComponent(cleanKey)}`,
    timeoutMs: 7000,
    providerName: 'Gemini',
  });
}

/**
 * Returns available Gemini models from curated static catalog.
 */
export async function listModels(_apiKey?: string): Promise<ModelInfo[]> {
  return getModelsByProvider('GEMINI');
}
