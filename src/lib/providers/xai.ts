/**
 * RepoSense xAI (Grok) Provider Adapter
 *
 * Implements xAI Grok chat and reasoning models:
 * grok-4.7 down through grok-3-mini.
 */

import { createXai } from '@ai-sdk/xai';
import { getModelsByProvider } from './catalog';
import type { ModelInfo, VerifyResult } from './types';
import { performHttpKeyValidation } from './validation-helper';

export const XAI_BASE_URL = 'https://api.x.ai/v1';

export type XAIClient = ReturnType<typeof createXai>;
export type XAIChatModel = ReturnType<XAIClient>;

/**
 * Creates an xAI SDK client bound to the provided API key.
 */
export function getXAIClient(apiKey: string): XAIClient {
  return createXai({
    apiKey: apiKey.trim(),
    baseURL: XAI_BASE_URL,
  });
}

/**
 * Resolves a chat/reasoning model instance for xAI.
 */
export function getChatModel(modelId: string, apiKey: string): XAIChatModel {
  const client = getXAIClient(apiKey);
  return client(modelId);
}

/**
 * Validates an xAI API key against /v1/models endpoint with timeout.
 */
export async function validateKey(apiKey: string): Promise<VerifyResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: {
        name: 'ProviderError',
        code: 'INVALID_KEY',
        message: 'xAI API key cannot be empty.',
      },
    };
  }

  return performHttpKeyValidation({
    url: `${XAI_BASE_URL}/models`,
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
    timeoutMs: 7000,
    providerName: 'xAI (Grok)',
  });
}

/**
 * Returns available xAI models from curated static catalog.
 */
export async function listModels(_apiKey?: string): Promise<ModelInfo[]> {
  return getModelsByProvider('XAI');
}
