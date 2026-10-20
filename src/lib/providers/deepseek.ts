/**
 * RepoSense DeepSeek Provider Adapter
 *
 * Implements DeepSeek chat and reasoning models:
 * deepseek-flash (V4.1 Flash), deepseek-v4-pro (V4 Pro), deepseek-reasoner (R1), deepseek-chat (V3).
 */

import { createDeepSeek } from '@ai-sdk/deepseek';
import { getModelsByProvider } from './catalog';
import type { ModelInfo, VerifyResult } from './types';
import { performHttpKeyValidation } from './validation-helper';

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export type DeepSeekClient = ReturnType<typeof createDeepSeek>;
export type DeepSeekChatModel = ReturnType<DeepSeekClient>;

/**
 * Creates a DeepSeek SDK client bound to the provided API key.
 */
export function getDeepSeekClient(apiKey: string): DeepSeekClient {
  return createDeepSeek({
    apiKey: apiKey.trim(),
    baseURL: DEEPSEEK_BASE_URL,
  });
}

/**
 * Resolves a chat/reasoning model instance for DeepSeek.
 */
export function getChatModel(modelId: string, apiKey: string): DeepSeekChatModel {
  const client = getDeepSeekClient(apiKey);
  return client(modelId);
}

/**
 * Validates a DeepSeek API key against /models endpoint with timeout.
 */
export async function validateKey(apiKey: string): Promise<VerifyResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: {
        name: 'ProviderError',
        code: 'INVALID_KEY',
        message: 'DeepSeek API key cannot be empty.',
      },
    };
  }

  return performHttpKeyValidation({
    url: `${DEEPSEEK_BASE_URL}/models`,
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
    timeoutMs: 7000,
    providerName: 'DeepSeek',
  });
}

/**
 * Returns available DeepSeek models from curated static catalog.
 */
export async function listModels(_apiKey?: string): Promise<ModelInfo[]> {
  return getModelsByProvider('DEEPSEEK');
}
