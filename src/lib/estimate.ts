/**
 * RepoSense Token & Cost Estimation
 *
 * Provides pre-indexing token and USD cost estimation for repositories.
 * Replaces legacy credit calculation with realistic token-based ranges.
 * Reference: reposense_revamp_migration_feature_plan.md (Phase 2)
 */

import { calculateModelCost } from './pricing';

export interface TokenRange {
  min: number;
  max: number;
}

export interface CostRange {
  min: number;
  max: number;
}

export interface TokenEstimate {
  files: number;
  inputTokens: TokenRange;
  outputTokens: TokenRange;
  embeddingTokens: number;
  estimatedCostUsd: CostRange;
}

export interface TreeEntryLike {
  path?: string;
  size?: number;
}

/** Typical average bytes per source code file in repositories (~3.5 KB) */
export const DEFAULT_AVG_BYTES_PER_FILE = 3500;

/** Average characters per token in source code and markdown */
const CHARS_PER_TOKEN = 4;

/** Summary output tokens generated per file */
const SUMMARY_OUTPUT_TOKENS_MIN = 100;
const SUMMARY_OUTPUT_TOKENS_MAX = 200;

/** Default chat model used for initial estimation when none specified */
export const DEFAULT_ESTIMATION_CHAT_MODEL = 'gpt-6.1-sol';

/** Default embedding model used for initial estimation */
export const DEFAULT_ESTIMATION_EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Estimates repository token usage from file count and average bytes per file.
 *
 * @param fileCount Number of eligible files to index
 * @param avgBytesPerFile Estimated average size per file in bytes (default 3,500)
 */
export function estimateRepoTokens(
  fileCount: number,
  avgBytesPerFile: number = DEFAULT_AVG_BYTES_PER_FILE
): Omit<TokenEstimate, 'estimatedCostUsd'> {
  const safeFileCount = Math.max(0, fileCount);
  const totalChars = safeFileCount * Math.max(100, avgBytesPerFile);

  const minChars = Math.round(totalChars * 0.7);
  const maxChars = Math.round(totalChars * 1.3);

  const minInputTokens = Math.ceil(minChars / CHARS_PER_TOKEN);
  const maxInputTokens = Math.ceil(maxChars / CHARS_PER_TOKEN);

  const minOutputTokens = safeFileCount * SUMMARY_OUTPUT_TOKENS_MIN;
  const maxOutputTokens = safeFileCount * SUMMARY_OUTPUT_TOKENS_MAX;

  // Embedding tokens: representation tokens across all indexed files
  const embeddingTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);

  return {
    files: safeFileCount,
    inputTokens: { min: minInputTokens, max: maxInputTokens },
    outputTokens: { min: minOutputTokens, max: maxOutputTokens },
    embeddingTokens,
  };
}

/**
 * Estimates total project indexing cost (chat summarization + embedding) for a model and file count.
 *
 * @param modelId Model binary identifier (e.g., 'gpt-6.1-sol', 'claude-sonnet-5')
 * @param fileCount Number of eligible files
 * @param avgBytesPerFile Optional average file size in bytes
 * @param embeddingModelId Optional embedding model (defaults to text-embedding-3-small)
 */
export function estimateProjectCost(
  modelId: string,
  fileCount: number,
  avgBytesPerFile: number = DEFAULT_AVG_BYTES_PER_FILE,
  embeddingModelId: string = DEFAULT_ESTIMATION_EMBEDDING_MODEL
): TokenEstimate {
  const tokenEstimate = estimateRepoTokens(fileCount, avgBytesPerFile);

  const minChatCost = calculateModelCost(
    modelId,
    tokenEstimate.inputTokens.min,
    tokenEstimate.outputTokens.min
  );
  const maxChatCost = calculateModelCost(
    modelId,
    tokenEstimate.inputTokens.max,
    tokenEstimate.outputTokens.max
  );

  const embeddingCost = calculateModelCost(
    embeddingModelId,
    tokenEstimate.embeddingTokens,
    0
  );

  return {
    ...tokenEstimate,
    estimatedCostUsd: {
      min: Number((minChatCost + embeddingCost).toFixed(4)),
      max: Number((maxChatCost + embeddingCost).toFixed(4)),
    },
  };
}

/**
 * Calculates a high-fidelity token and cost estimate from a pre-filtered GitHub git tree.
 *
 * @param entries Array of file entries with file size from the GitHub Tree API
 * @param modelId Target chat model ID
 * @param embeddingModelId Target embedding model ID
 */
export function estimateRepoTokensFromTree(
  entries: ReadonlyArray<TreeEntryLike>,
  modelId: string = DEFAULT_ESTIMATION_CHAT_MODEL,
  embeddingModelId: string = DEFAULT_ESTIMATION_EMBEDDING_MODEL
): TokenEstimate {
  const eligibleEntries = entries.filter((entry) => typeof entry.size === 'number' && entry.size > 0);
  const fileCount = eligibleEntries.length;

  const totalBytes = eligibleEntries.reduce((sum, entry) => sum + (entry.size ?? 0), 0);
  const avgBytes = fileCount > 0 ? Math.round(totalBytes / fileCount) : DEFAULT_AVG_BYTES_PER_FILE;

  const minChars = Math.round(totalBytes * 0.85);
  const maxChars = Math.round(totalBytes * 1.15);

  const minInputTokens = Math.ceil(minChars / CHARS_PER_TOKEN);
  const maxInputTokens = Math.ceil(maxChars / CHARS_PER_TOKEN);

  const minOutputTokens = fileCount * SUMMARY_OUTPUT_TOKENS_MIN;
  const maxOutputTokens = fileCount * SUMMARY_OUTPUT_TOKENS_MAX;

  const embeddingTokens = Math.ceil(totalBytes / CHARS_PER_TOKEN);

  const minChatCost = calculateModelCost(modelId, minInputTokens, minOutputTokens);
  const maxChatCost = calculateModelCost(modelId, maxInputTokens, maxOutputTokens);
  const embeddingCost = calculateModelCost(embeddingModelId, embeddingTokens, 0);

  return {
    files: fileCount,
    inputTokens: { min: minInputTokens, max: maxInputTokens },
    outputTokens: { min: minOutputTokens, max: maxOutputTokens },
    embeddingTokens,
    estimatedCostUsd: {
      min: Number((minChatCost + embeddingCost).toFixed(4)),
      max: Number((maxChatCost + embeddingCost).toFixed(4)),
    },
  };
}
