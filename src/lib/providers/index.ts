/**
 * RepoSense Unified Provider Registry & Factory
 *
 * Single point of entry for chat models, embedding models, key validation,
 * model listing, and catalog queries across all 7 supported AI providers.
 * Reference: reposense_model_selector_provider_binaries_context.md
 */

import * as anthropicAdapter from './anthropic';
import * as deepseekAdapter from './deepseek';
import * as geminiAdapter from './gemini';
import * as groqAdapter from './groq';
import * as metaAdapter from './meta';
import * as openaiAdapter from './openai';
import {
  ProviderError,
  type AnyChatModel,
  type AnyEmbeddingModel,
  type EmbeddingProviderId,
  type ModelInfo,
  type ProviderId,
  type VerifyResult,
} from './types';
import * as xaiAdapter from './xai';

// Re-export all sub-modules for clean downstream imports
export * from './catalog';
export * from './crypto';
export * from './types';
export { META_DEFAULT_PROVIDER_OPTIONS } from './meta';
export { GROQ_ALLOWED_MODELS } from './groq';

/**
 * Returns an instantiated model instance for the target provider and model ID.
 *
 * @param provider Target LLM provider ('OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'META' | 'DEEPSEEK' | 'XAI' | 'GROQ')
 * @param modelId Model binary identifier (e.g. 'gpt-6.1-sol', 'claude-sonnet-5', 'muse-spark-1.3')
 * @param apiKey User's plaintext API key
 */
export function getModel(
  provider: ProviderId,
  modelId: string,
  apiKey: string
): AnyChatModel {
  switch (provider) {
    case 'OPENAI':
      return openaiAdapter.getChatModel(modelId, apiKey);
    case 'ANTHROPIC':
      return anthropicAdapter.getChatModel(modelId, apiKey);
    case 'GEMINI':
      return geminiAdapter.getChatModel(modelId, apiKey);
    case 'META':
      return metaAdapter.getChatModel(modelId, apiKey);
    case 'DEEPSEEK':
      return deepseekAdapter.getChatModel(modelId, apiKey);
    case 'XAI':
      return xaiAdapter.getChatModel(modelId, apiKey);
    case 'GROQ':
      return groqAdapter.getChatModel(modelId, apiKey);
    default: {
      const _exhaustive: never = provider;
      throw new ProviderError(
        'PROVIDER_ERROR',
        `Unsupported provider identifier: ${String(_exhaustive)}`
      );
    }
  }
}

/**
 * Returns an instantiated embedding model instance for the target embedding provider.
 * RepoSense locks project embeddings to either 'OPENAI' (1536 dims) or 'GEMINI' (768 dims).
 *
 * @param provider 'OPENAI' or 'GEMINI'
 * @param modelId Model identifier (e.g., 'text-embedding-3-small', 'gemini-embedding-001')
 * @param apiKey User's plaintext API key
 */
export function getEmbeddingModel(
  provider: EmbeddingProviderId,
  modelId: string,
  apiKey: string
): AnyEmbeddingModel {
  switch (provider) {
    case 'OPENAI':
      return openaiAdapter.getEmbeddingModel(modelId, apiKey);
    case 'GEMINI':
      return geminiAdapter.getEmbeddingModel(modelId, apiKey);
    default: {
      const _exhaustive: never = provider;
      throw new ProviderError(
        'PROVIDER_ERROR',
        `Unsupported embedding provider identifier: ${String(_exhaustive)}`
      );
    }
  }
}

/**
 * Validates a user's API key with a fast network ping and normalized error diagnostics.
 *
 * @param provider Provider enum
 * @param apiKey User's plaintext API key
 * @returns { valid: true } or { valid: false, error: ProviderError }
 */
export async function validateProviderKey(
  provider: ProviderId,
  apiKey: string
): Promise<VerifyResult> {
  switch (provider) {
    case 'OPENAI':
      return openaiAdapter.validateKey(apiKey);
    case 'ANTHROPIC':
      return anthropicAdapter.validateKey(apiKey);
    case 'GEMINI':
      return geminiAdapter.validateKey(apiKey);
    case 'META':
      return metaAdapter.validateKey(apiKey);
    case 'DEEPSEEK':
      return deepseekAdapter.validateKey(apiKey);
    case 'XAI':
      return xaiAdapter.validateKey(apiKey);
    case 'GROQ':
      return groqAdapter.validateKey(apiKey);
    default: {
      const _exhaustive: never = provider;
      throw new ProviderError(
        'PROVIDER_ERROR',
        `Unsupported provider for key verification: ${String(_exhaustive)}`
      );
    }
  }
}

/**
 * Returns all supported models for a provider, prioritizing the curated static catalog.
 *
 * @param provider Provider enum
 * @param apiKey Optional key for future dynamic metadata enrichment
 */
export async function listProviderModels(
  provider: ProviderId,
  apiKey?: string
): Promise<ModelInfo[]> {
  switch (provider) {
    case 'OPENAI':
      return openaiAdapter.listModels(apiKey);
    case 'ANTHROPIC':
      return anthropicAdapter.listModels(apiKey);
    case 'GEMINI':
      return geminiAdapter.listModels(apiKey);
    case 'META':
      return metaAdapter.listModels(apiKey);
    case 'DEEPSEEK':
      return deepseekAdapter.listModels(apiKey);
    case 'XAI':
      return xaiAdapter.listModels(apiKey);
    case 'GROQ':
      return groqAdapter.listModels(apiKey);
    default: {
      const _exhaustive: never = provider;
      throw new ProviderError(
        'PROVIDER_ERROR',
        `Unsupported provider for model listing: ${String(_exhaustive)}`
      );
    }
  }
}
