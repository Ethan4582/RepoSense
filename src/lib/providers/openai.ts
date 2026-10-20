/**
 * RepoSense OpenAI Provider Adapter
 *
 * Implements chat models (from GPT-6 Astra down to GPT-4o-mini) and
 * embedding models (text-embedding-3-small & text-embedding-3-large).
 */

import { createOpenAI } from '@ai-sdk/openai';
import { getModelsByProvider } from './catalog';
import type { ModelInfo, VerifyResult } from './types';
import { performHttpKeyValidation } from './validation-helper';

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export type OpenAIClient = ReturnType<typeof createOpenAI>;
export type OpenAIChatModel = ReturnType<OpenAIClient>;
export type OpenAIEmbeddingModel = ReturnType<OpenAIClient['textEmbeddingModel']>;

/**
 * Creates an OpenAI SDK client bound to the provided API key.
 */
export function getOpenAIClient(apiKey: string): OpenAIClient {
  return createOpenAI({
    apiKey: apiKey.trim(),
    baseURL: OPENAI_BASE_URL,
  });
}

/**
 * Resolves a chat/reasoning model instance for OpenAI.
 */
export function getChatModel(modelId: string, apiKey: string): OpenAIChatModel {
  const client = getOpenAIClient(apiKey);
  return client(modelId);
}

/**
 * Resolves an embedding model for OpenAI.
 */
export function getEmbeddingModel(
  modelId: string,
  apiKey: string
): OpenAIEmbeddingModel {
  const client = getOpenAIClient(apiKey);
  return client.textEmbeddingModel(modelId);
}

/**
 * Validates an OpenAI API key against the /v1/models endpoint with timeout.
 */
export async function validateKey(apiKey: string): Promise<VerifyResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: {
        name: 'ProviderError',
        code: 'INVALID_KEY',
        message: 'OpenAI API key cannot be empty.',
      },
    };
  }

  return performHttpKeyValidation({
    url: `${OPENAI_BASE_URL}/models`,
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
    timeoutMs: 7000,
    providerName: 'OpenAI',
  });
}

/**
 * Returns available OpenAI models, prioritizing the static curated catalog.
 */
export async function listModels(_apiKey?: string): Promise<ModelInfo[]> {
  return getModelsByProvider('OPENAI');
}
