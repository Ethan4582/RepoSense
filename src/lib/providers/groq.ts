/**
 * RepoSense Groq Provider Adapter
 *
 * Implements Groq via @ai-sdk/openai targeting https://api.groq.com/openai/v1.
 * Strictly capped at 3 models per product specification:
 * - llama-3.3-70b-versatile (Default chat)
 * - llama-3.1-8b-instant (Fast indexing)
 * - openai/gpt-oss-120b (Frontier LPU reasoning)
 */

import { createOpenAI } from '@ai-sdk/openai';
import { getModelsByProvider } from './catalog';
import { ProviderError, type ModelInfo, type VerifyResult } from './types';
import { performHttpKeyValidation } from './validation-helper';

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export const GROQ_ALLOWED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
] as const;

export type GroqModelId = (typeof GROQ_ALLOWED_MODELS)[number];
export type GroqClient = ReturnType<typeof createOpenAI>;
export type GroqChatModel = ReturnType<GroqClient>;

/**
 * Creates an OpenAI-compatible SDK client bound to the Groq API.
 */
export function getGroqClient(apiKey: string): GroqClient {
  return createOpenAI({
    apiKey: apiKey.trim(),
    baseURL: GROQ_BASE_URL,
  });
}

/**
 * Resolves a chat model instance on Groq.
 * Enforces the strict 3-model limitation.
 */
export function getChatModel(modelId: string, apiKey: string): GroqChatModel {
  const isAllowed = (GROQ_ALLOWED_MODELS as readonly string[]).includes(modelId);
  if (!isAllowed) {
    throw new ProviderError(
      'MODEL_NOT_AVAILABLE',
      `Model "${modelId}" is not in the curated Groq binary list. Permitted models: ${GROQ_ALLOWED_MODELS.join(', ')}.`
    );
  }

  const client = getGroqClient(apiKey);
  return client(modelId);
}

/**
 * Validates a Groq API key against /openai/v1/models with timeout.
 */
export async function validateKey(apiKey: string): Promise<VerifyResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: {
        name: 'ProviderError',
        code: 'INVALID_KEY',
        message: 'Groq API key cannot be empty.',
      },
    };
  }

  return performHttpKeyValidation({
    url: `${GROQ_BASE_URL}/models`,
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
    timeoutMs: 7000,
    providerName: 'Groq',
  });
}

/**
 * Returns the strictly allowed 3 Groq models from catalog.
 */
export async function listModels(_apiKey?: string): Promise<ModelInfo[]> {
  return getModelsByProvider('GROQ');
}
