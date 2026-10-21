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
 * Normalizes modern provider models (spec version v4) to be compatible with AI SDK v4 (spec version v1).
 */
export function ensureV1LanguageModel(model: any): AnyChatModel {
  if (!model || model.specificationVersion === 'v1') return model;

  return new Proxy(model, {
    get(target, prop, receiver) {
      if (prop === 'specificationVersion') return 'v1';
      if (prop === 'doGenerate') {
        return async (options: any) => {
          const res = await target.doGenerate(options);
          const extractedText =
            res.text ??
            (Array.isArray(res.content)
              ? res.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('')
              : '');
          return {
            ...res,
            text: extractedText,
          };
        };
      }
      if (prop === 'doStream') {
        return async (options: any) => {
          const res = await target.doStream(options);
          const origStream = res.stream;
          const reader = origStream.getReader();
          const transformedStream = new ReadableStream({
            async pull(controller) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  return;
                }
                if (value.type === 'text-delta') {
                  controller.enqueue({
                    ...value,
                    textDelta: value.delta ?? value.textDelta ?? '',
                  });
                  return;
                } else if (
                  value.type === 'finish' ||
                  value.type === 'error' ||
                  value.type === 'tool-call'
                ) {
                  controller.enqueue(value);
                  return;
                }
              }
            },
            cancel(reason) {
              return reader.cancel(reason);
            },
          });
          return {
            ...res,
            stream: transformedStream,
          };
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

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
  let model: AnyChatModel;
  switch (provider) {
    case 'OPENAI':
      model = openaiAdapter.getChatModel(modelId, apiKey);
      break;
    case 'ANTHROPIC':
      model = anthropicAdapter.getChatModel(modelId, apiKey);
      break;
    case 'GEMINI':
      model = geminiAdapter.getChatModel(modelId, apiKey);
      break;
    case 'META':
      model = metaAdapter.getChatModel(modelId, apiKey);
      break;
    case 'DEEPSEEK':
      model = deepseekAdapter.getChatModel(modelId, apiKey);
      break;
    case 'XAI':
      model = xaiAdapter.getChatModel(modelId, apiKey);
      break;
    case 'GROQ':
      model = groqAdapter.getChatModel(modelId, apiKey);
      break;
    default: {
      const _exhaustive: never = provider;
      throw new ProviderError(
        'PROVIDER_ERROR',
        `Unsupported provider identifier: ${String(_exhaustive)}`
      );
    }
  }
  return ensureV1LanguageModel(model);
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
 */
export async function validateApiKey(
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
        `Unsupported provider identifier: ${String(_exhaustive)}`
      );
    }
  }
}

export { validateApiKey as validateProviderKey };
