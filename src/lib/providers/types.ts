/**
 * RepoSense Provider & Model Types
 *
 * Strict discriminated union definitions, normalized provider error types,
 * key statuses, model metadata, and unified model return types.
 * Reference: reposense_model_selector_provider_binaries_context.md
 */

import type { createAnthropic } from '@ai-sdk/anthropic';
import type { createDeepSeek } from '@ai-sdk/deepseek';
import type { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { createOpenAI } from '@ai-sdk/openai';
import type { createXai } from '@ai-sdk/xai';
import type { PricingTier } from '../pricing';

export type { PricingTier };

/** Supported LLM providers */
export type ProviderId =
  | 'OPENAI'
  | 'ANTHROPIC'
  | 'GEMINI'
  | 'META'
  | 'DEEPSEEK'
  | 'XAI'
  | 'GROQ';

/** Lowercase provider config keys */
export type ProviderConfigKey =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'meta'
  | 'deepseek'
  | 'xai'
  | 'groq';

/** Providers supporting dense vector embeddings */
export type EmbeddingProviderId = 'OPENAI' | 'GEMINI';

/** User API key status in vault */
export type KeyStatus =
  | 'UNVERIFIED'
  | 'VALID'
  | 'INVALID'
  | 'QUOTA_EXHAUSTED';

/** Normalized error classes across all 7 AI providers */
export type ProviderErrorCode =
  | 'INVALID_KEY'
  | 'QUOTA_EXHAUSTED'
  | 'MODEL_NOT_AVAILABLE'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR';

/** Normalized error thrown or returned by provider adapters */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly statusCode?: number;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options?: { statusCode?: number; details?: unknown; cause?: unknown }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** Discriminated key verification result */
export type VerifyResult =
  | { readonly valid: true; readonly error?: undefined }
  | { readonly valid: false; readonly error: ProviderError };

/** Static and dynamic model descriptor */
export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly provider: ProviderId;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly inputCostPerMillion: number;
  readonly outputCostPerMillion: number;
  readonly cachedInputCostPerMillion?: number;
  readonly tier: PricingTier;
  readonly description: string;
  readonly isRecommended?: boolean;
  readonly isDefaultChat?: boolean;
  readonly isDefaultFast?: boolean;
  readonly isEmbedding?: boolean;
  readonly dimensions?: number;
}

/** Provider metadata configuration */
export interface ProviderMetadata {
  readonly id: ProviderId;
  readonly configKey: ProviderConfigKey;
  readonly displayName: string;
  readonly npmAdapter: string;
  readonly baseUrl: string;
  readonly logoAsset: string;
  readonly supportsEmbeddings: boolean;
  readonly defaultChatModel: string;
  readonly defaultFastModel: string;
  readonly defaultEmbeddingModel?: string;
  readonly recommendedModels: readonly string[];
}

/** Chat model instance types produced by supported providers */
export type AnyChatModel =
  | ReturnType<ReturnType<typeof createOpenAI>>
   
  | ReturnType<ReturnType<typeof createGoogleGenerativeAI>>
   
   ;

/** Embedding model instance types produced by supported embedding providers */
export type AnyEmbeddingModel =
  | ReturnType<ReturnType<typeof createOpenAI>['textEmbeddingModel']>
  | ReturnType<ReturnType<typeof createGoogleGenerativeAI>['textEmbeddingModel']>;
