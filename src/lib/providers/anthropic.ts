/**
 * RepoSense Anthropic Provider Adapter
 *
 * Implements chat models across Fable (Mythos-class), Opus 5.5/5/4.x, Sonnet 5/4.6/3.7, and Haiku.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { getModelsByProvider } from './catalog';
import type { ModelInfo, VerifyResult } from './types';
import { performHttpKeyValidation } from './validation-helper';

export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export type AnthropicClient = ReturnType<typeof createAnthropic>;
export type AnthropicChatModel = ReturnType<AnthropicClient>;

/**
 * Creates an Anthropic SDK client bound to the provided API key.
 */
export function getAnthropicClient(apiKey: string): AnthropicClient {
  return createAnthropic({
    apiKey: apiKey.trim(),
    baseURL: ANTHROPIC_BASE_URL,
  });
}

/**
 * Resolves a chat/reasoning model instance for Anthropic.
 */
export function getChatModel(modelId: string, apiKey: string): AnthropicChatModel {
  const client = getAnthropicClient(apiKey);
  return client(modelId);
}

/**
 * Validates an Anthropic API key against the /v1/models endpoint with timeout.
 */
export async function validateKey(apiKey: string): Promise<VerifyResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: {
        name: 'ProviderError',
        code: 'INVALID_KEY',
        message: 'Anthropic API key cannot be empty.',
      },
    };
  }

  return performHttpKeyValidation({
    url: `${ANTHROPIC_BASE_URL}/models`,
    headers: {
      'x-api-key': cleanKey,
      'anthropic-version': '2023-06-01',
    },
    timeoutMs: 7000,
    providerName: 'Anthropic',
  });
}

/**
 * Returns available Anthropic models from curated static catalog.
 */
export async function listModels(_apiKey?: string): Promise<ModelInfo[]> {
  return getModelsByProvider('ANTHROPIC');
}
