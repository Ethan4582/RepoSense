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
  return (typeof client.chat === 'function' ? client.chat(modelId) : client(modelId)) as OpenAIChatModel;
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
    providerName: 'OpenAI',
    url: `${OPENAI_BASE_URL}/models`,
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
    timeoutMs: 8000,
  });
}

/**
 * Returns static model info for all supported OpenAI chat and reasoning models.
 */
export function listModels(): ModelInfo[] {
  return getModelsByProvider('OPENAI');
}
