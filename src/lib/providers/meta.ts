/**
 * RepoSense Meta Model API Provider Adapter
 *
 * Implements Meta Model API via @ai-sdk/openai targeting the Responses API
 * at https://api.meta.ai/v1 with high reasoning effort and encrypted reasoning content.
 * Models: muse-wonder, muse-spark-1.3, muse-spark-1.3-contributor, muse-spark-1.2, etc.
 * Reference: Section 2 of reposense_model_selector_provider_binaries_context.md
 */

import { createOpenAI } from '@ai-sdk/openai';
import { getModelsByProvider } from './catalog';
import type { ModelInfo, VerifyResult } from './types';
import { performHttpKeyValidation } from './validation-helper';

export const META_BASE_URL = 'https://api.meta.ai/v1';

export type MetaClient = ReturnType<typeof createOpenAI>;
export type MetaChatModel = ReturnType<MetaClient>;

/**
 * Standard reasoning options required for Meta models (muse-spark-1.3, muse-wonder, etc.)
 */
export const META_DEFAULT_PROVIDER_OPTIONS = {
  openai: {
    reasoningEffort: 'high' as const,
    reasoningSummary: 'auto' as const,
    include: ['reasoning.encrypted_content'],
  },
} as const;

/**
 * Creates an OpenAI provider configured for Meta Model API.
 */
export function getMetaClient(apiKey: string): MetaClient {
  return createOpenAI({
    apiKey: apiKey.trim(),
    baseURL: META_BASE_URL,
  });
}

/**
 * Resolves a Meta model instance via the Responses API (client.responses(modelId)).
 */
export function getChatModel(modelId: string, apiKey: string): MetaChatModel {
  const client = getMetaClient(apiKey);
  return client.responses(modelId);
}

/**
 * Validates a Meta API key against https://api.meta.ai/v1/models with timeout.
 */
export async function validateKey(apiKey: string): Promise<VerifyResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: {
        name: 'ProviderError',
        code: 'INVALID_KEY',
        message: 'Meta API key cannot be empty.',
      },
    };
  }

  return performHttpKeyValidation({
    url: `${META_BASE_URL}/models`,
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
    timeoutMs: 7000,
    providerName: 'Meta Model API',
  });
}

/**
 * Returns available Meta models from curated static catalog.
 */
export async function listModels(_apiKey?: string): Promise<ModelInfo[]> {
  return getModelsByProvider('META');
}
