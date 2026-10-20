/**
 * RepoSense Model Pricing & Tier Badges
 *
 * Authoritative pricing configuration and cost calculation rules.
 * Reference: reposense_model_selector_provider_binaries_context.md
 *
 * NOTE: Pricing figures are estimates for project indexing and RAG budgeting;
 * users should verify current rates against respective provider rate cards.
 */

export type PricingTier = '$' | '$$' | '$$$' | '$$$+';

export interface ModelPricing {
  modelId: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCostPerMillion?: number;
  tier: PricingTier;
}

export interface PricingTierMeta {
  badge: PricingTier;
  label: string;
  range: string;
  description: string;
  maxOutputCost: number;
}

export const PRICING_TIERS: Record<PricingTier, PricingTierMeta> = {
  $: {
    badge: '$',
    label: 'Budget / High-speed',
    range: '<= $1.50 / 1M output',
    description: 'Ultra-fast, economical models ideal for bulk indexing and rapid chat',
    maxOutputCost: 1.5,
  },
  $$: {
    badge: '$$',
    label: 'Balanced / Daily Driver',
    range: '$1.51 – $12.00 / 1M output',
    description: 'High-intelligence workhorse models for daily coding, refactoring, and debugging',
    maxOutputCost: 12.0,
  },
  $$$: {
    badge: '$$$',
    label: 'Frontier Pro',
    range: '$12.01 – $30.00 / 1M output',
    description: 'Extended reasoning, deep multi-file synthesis, and complex architecture work',
    maxOutputCost: 30.0,
  },
  '$$$+': {
    badge: '$$$+',
    label: 'Ultra-Frontier / Max Reasoning',
    range: '> $30.00 / 1M output',
    description: 'Maximum-compute frontier and Mythos-class reasoning models for hardest proofs & audits',
    maxOutputCost: Infinity,
  },
} as const;

/**
 * Derives the pricing tier badge from output cost per 1M tokens.
 */
export function getPriceBadge(outputCostPerMillion: number): PricingTier {
  if (outputCostPerMillion <= 1.5) {
    return '$';
  }
  if (outputCostPerMillion <= 12.0) {
    return '$$';
  }
  if (outputCostPerMillion <= 30.0) {
    return '$$$';
  }
  return '$$$+';
}

/**
 * Complete model pricing catalog covering all 7 providers.
 */
export const MODEL_PRICING_CATALOG: Readonly<Record<string, ModelPricing>> = {
  // =========================================================================
  // OpenAI Models
  // =========================================================================
  'gpt-6-astra': {
    modelId: 'gpt-6-astra',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 50.0,
    cachedInputCostPerMillion: 1.0,
    tier: '$$$+',
  },
  'gpt-6.1-sol': {
    modelId: 'gpt-6.1-sol',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 10.0,
    cachedInputCostPerMillion: 0.1,
    tier: '$$',
  },
  'gpt-6-sol': {
    modelId: 'gpt-6-sol',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 10.0,
    cachedInputCostPerMillion: 0.1,
    tier: '$$',
  },
  'gpt-6-luna': {
    modelId: 'gpt-6-luna',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.5,
    cachedInputCostPerMillion: 0.01,
    tier: '$',
  },
  'gpt-5.6-sol': {
    modelId: 'gpt-5.6-sol',
    inputCostPerMillion: 4.0,
    outputCostPerMillion: 20.0,
    cachedInputCostPerMillion: 0.4,
    tier: '$$$',
  },
  'gpt-5.6-terra': {
    modelId: 'gpt-5.6-terra',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 12.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'gpt-5.6-luna': {
    modelId: 'gpt-5.6-luna',
    inputCostPerMillion: 0.2,
    outputCostPerMillion: 1.2,
    cachedInputCostPerMillion: 0.02,
    tier: '$',
  },
  'gpt-5.5-pro': {
    modelId: 'gpt-5.5-pro',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 40.0,
    cachedInputCostPerMillion: 1.0,
    tier: '$$$+',
  },
  'gpt-5.5': {
    modelId: 'gpt-5.5',
    inputCostPerMillion: 5.0,
    outputCostPerMillion: 30.0,
    cachedInputCostPerMillion: 0.5,
    tier: '$$$',
  },
  'gpt-5.4-pro': {
    modelId: 'gpt-5.4-pro',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 40.0,
    cachedInputCostPerMillion: 1.0,
    tier: '$$$+',
  },
  'gpt-5.4': {
    modelId: 'gpt-5.4',
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
    cachedInputCostPerMillion: 0.25,
    tier: '$$',
  },
  'gpt-5.4-mini': {
    modelId: 'gpt-5.4-mini',
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.6,
    cachedInputCostPerMillion: 0.04,
    tier: '$',
  },
  'gpt-5.4-nano': {
    modelId: 'gpt-5.4-nano',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    cachedInputCostPerMillion: 0.01,
    tier: '$',
  },
  'gpt-5.3-codex': {
    modelId: 'gpt-5.3-codex',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 8.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'gpt-5': {
    modelId: 'gpt-5',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 8.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'gpt-5-mini': {
    modelId: 'gpt-5-mini',
    inputCostPerMillion: 0.3,
    outputCostPerMillion: 1.2,
    cachedInputCostPerMillion: 0.03,
    tier: '$',
  },
  'gpt-5-nano': {
    modelId: 'gpt-5-nano',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    cachedInputCostPerMillion: 0.01,
    tier: '$',
  },
  'o3-pro': {
    modelId: 'o3-pro',
    inputCostPerMillion: 20.0,
    outputCostPerMillion: 80.0,
    tier: '$$$+',
  },
  'o3': {
    modelId: 'o3',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 8.0,
    cachedInputCostPerMillion: 0.5,
    tier: '$$',
  },
  'o4-mini': {
    modelId: 'o4-mini',
    inputCostPerMillion: 1.1,
    outputCostPerMillion: 4.4,
    cachedInputCostPerMillion: 0.275,
    tier: '$$',
  },
  'o3-mini': {
    modelId: 'o3-mini',
    inputCostPerMillion: 1.1,
    outputCostPerMillion: 4.4,
    cachedInputCostPerMillion: 0.55,
    tier: '$$',
  },
  'gpt-4.1': {
    modelId: 'gpt-4.1',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 8.0,
    cachedInputCostPerMillion: 0.5,
    tier: '$$',
  },
  'gpt-4.1-mini': {
    modelId: 'gpt-4.1-mini',
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.6,
    cachedInputCostPerMillion: 0.1,
    tier: '$',
  },
  'gpt-4.1-nano': {
    modelId: 'gpt-4.1-nano',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    cachedInputCostPerMillion: 0.025,
    tier: '$',
  },
  'gpt-4o': {
    modelId: 'gpt-4o',
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
    cachedInputCostPerMillion: 1.25,
    tier: '$$',
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    cachedInputCostPerMillion: 0.075,
    tier: '$',
  },
  'text-embedding-3-small': {
    modelId: 'text-embedding-3-small',
    inputCostPerMillion: 0.02,
    outputCostPerMillion: 0.0,
    tier: '$',
  },
  'text-embedding-3-large': {
    modelId: 'text-embedding-3-large',
    inputCostPerMillion: 0.13,
    outputCostPerMillion: 0.0,
    tier: '$',
  },

  // =========================================================================
  // Anthropic Models
  // =========================================================================
  'claude-fable-5-1': {
    modelId: 'claude-fable-5-1',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 50.0,
    cachedInputCostPerMillion: 1.0,
    tier: '$$$+',
  },
  'claude-fable-5': {
    modelId: 'claude-fable-5',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 50.0,
    cachedInputCostPerMillion: 1.0,
    tier: '$$$+',
  },
  'claude-opus-5-5': {
    modelId: 'claude-opus-5-5',
    inputCostPerMillion: 6.0,
    outputCostPerMillion: 30.0,
    cachedInputCostPerMillion: 0.6,
    tier: '$$$',
  },
  'claude-opus-5': {
    modelId: 'claude-opus-5',
    inputCostPerMillion: 5.0,
    outputCostPerMillion: 25.0,
    cachedInputCostPerMillion: 0.5,
    tier: '$$$',
  },
  'claude-opus-4-8': {
    modelId: 'claude-opus-4-8',
    inputCostPerMillion: 5.0,
    outputCostPerMillion: 25.0,
    cachedInputCostPerMillion: 0.5,
    tier: '$$$',
  },
  'claude-opus-4-7': {
    modelId: 'claude-opus-4-7',
    inputCostPerMillion: 5.0,
    outputCostPerMillion: 25.0,
    cachedInputCostPerMillion: 0.5,
    tier: '$$$',
  },
  'claude-opus-4-6': {
    modelId: 'claude-opus-4-6',
    inputCostPerMillion: 5.0,
    outputCostPerMillion: 25.0,
    cachedInputCostPerMillion: 0.5,
    tier: '$$$',
  },
  'claude-3-opus-latest': {
    modelId: 'claude-3-opus-latest',
    inputCostPerMillion: 15.0,
    outputCostPerMillion: 75.0,
    cachedInputCostPerMillion: 1.5,
    tier: '$$$+',
  },
  'claude-sonnet-5': {
    modelId: 'claude-sonnet-5',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCostPerMillion: 0.3,
    tier: '$$',
  },
  'claude-sonnet-4-6': {
    modelId: 'claude-sonnet-4-6',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCostPerMillion: 0.3,
    tier: '$$',
  },
  'claude-sonnet-4-5': {
    modelId: 'claude-sonnet-4-5',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCostPerMillion: 0.3,
    tier: '$$',
  },
  'claude-3-7-sonnet-latest': {
    modelId: 'claude-3-7-sonnet-latest',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCostPerMillion: 0.3,
    tier: '$$',
  },
  'claude-haiku-5-5': {
    modelId: 'claude-haiku-5-5',
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4.0,
    cachedInputCostPerMillion: 0.08,
    tier: '$',
  },
  'claude-haiku-4-5': {
    modelId: 'claude-haiku-4-5',
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4.0,
    cachedInputCostPerMillion: 0.08,
    tier: '$',
  },
  'claude-3-5-haiku-latest': {
    modelId: 'claude-3-5-haiku-latest',
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4.0,
    cachedInputCostPerMillion: 0.08,
    tier: '$',
  },

  // =========================================================================
  // Gemini Models
  // =========================================================================
  'gemini-4-argon': {
    modelId: 'gemini-4-argon',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 10.0,
    cachedInputCostPerMillion: 0.1,
    tier: '$$',
  },
  'gemini-3.1-pro-preview': {
    modelId: 'gemini-3.1-pro-preview',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 12.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'gemini-3-deep-think': {
    modelId: 'gemini-3-deep-think',
    inputCostPerMillion: 4.0,
    outputCostPerMillion: 16.0,
    cachedInputCostPerMillion: 0.4,
    tier: '$$$',
  },
  'gemini-3.8-flash': {
    modelId: 'gemini-3.8-flash',
    inputCostPerMillion: 0.3,
    outputCostPerMillion: 2.5,
    cachedInputCostPerMillion: 0.03,
    tier: '$',
  },
  'gemini-3.5-flash': {
    modelId: 'gemini-3.5-flash',
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 1.5,
    cachedInputCostPerMillion: 0.025,
    tier: '$',
  },
  'gemini-3.5-flash-lite': {
    modelId: 'gemini-3.5-flash-lite',
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.3,
    cachedInputCostPerMillion: 0.01,
    tier: '$',
  },
  'gemini-3-flash-preview': {
    modelId: 'gemini-3-flash-preview',
    inputCostPerMillion: 0.2,
    outputCostPerMillion: 1.0,
    cachedInputCostPerMillion: 0.02,
    tier: '$',
  },
  'gemini-2.5-pro': {
    modelId: 'gemini-2.5-pro',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 10.0,
    cachedInputCostPerMillion: 0.125,
    tier: '$$',
  },
  'gemini-2.5-flash': {
    modelId: 'gemini-2.5-flash',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    cachedInputCostPerMillion: 0.0375,
    tier: '$',
  },
  'gemini-2.5-flash-lite': {
    modelId: 'gemini-2.5-flash-lite',
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.3,
    cachedInputCostPerMillion: 0.018,
    tier: '$',
  },
  'gemini-embedding-001': {
    modelId: 'gemini-embedding-001',
    inputCostPerMillion: 0.025,
    outputCostPerMillion: 0.0,
    tier: '$',
  },

  // =========================================================================
  // Meta Model API Models
  // =========================================================================
  'muse-wonder': {
    modelId: 'muse-wonder',
    inputCostPerMillion: 4.0,
    outputCostPerMillion: 20.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$$',
  },
  'muse-spark-1.3': {
    modelId: 'muse-spark-1.3',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 4.25,
    cachedInputCostPerMillion: 0.15,
    tier: '$$',
  },
  'muse-spark-1.3-contributor': {
    modelId: 'muse-spark-1.3-contributor',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.2,
    cachedInputCostPerMillion: 0.002,
    tier: '$',
  },
  'muse-spark-1.2': {
    modelId: 'muse-spark-1.2',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 4.25,
    cachedInputCostPerMillion: 0.15,
    tier: '$$',
  },
  'muse-spark-1.2-contributor': {
    modelId: 'muse-spark-1.2-contributor',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.2,
    cachedInputCostPerMillion: 0.002,
    tier: '$',
  },
  'muse-spark-1.1': {
    modelId: 'muse-spark-1.1',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 4.25,
    cachedInputCostPerMillion: 0.15,
    tier: '$$',
  },

  // =========================================================================
  // DeepSeek Models
  // =========================================================================
  'deepseek-flash': {
    modelId: 'deepseek-flash',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    cachedInputCostPerMillion: 0.03,
    tier: '$',
  },
  'deepseek-v4-pro': {
    modelId: 'deepseek-v4-pro',
    inputCostPerMillion: 0.5,
    outputCostPerMillion: 1.98,
    cachedInputCostPerMillion: 0.1,
    tier: '$$',
  },
  'deepseek-reasoner': {
    modelId: 'deepseek-reasoner',
    inputCostPerMillion: 0.55,
    outputCostPerMillion: 2.19,
    cachedInputCostPerMillion: 0.14,
    tier: '$$',
  },
  'deepseek-chat': {
    modelId: 'deepseek-chat',
    inputCostPerMillion: 0.27,
    outputCostPerMillion: 1.1,
    cachedInputCostPerMillion: 0.07,
    tier: '$',
  },

  // =========================================================================
  // xAI (Grok) Models
  // =========================================================================
  'grok-4.7': {
    modelId: 'grok-4.7',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 6.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'grok-4.6': {
    modelId: 'grok-4.6',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 6.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'grok-4.5': {
    modelId: 'grok-4.5',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 6.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'grok-4.20-reasoning': {
    modelId: 'grok-4.20-reasoning',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 8.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'grok-4.1': {
    modelId: 'grok-4.1',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 6.0,
    cachedInputCostPerMillion: 0.2,
    tier: '$$',
  },
  'grok-4.1-fast': {
    modelId: 'grok-4.1-fast',
    inputCostPerMillion: 0.5,
    outputCostPerMillion: 2.0,
    cachedInputCostPerMillion: 0.05,
    tier: '$',
  },
  'grok-4': {
    modelId: 'grok-4',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCostPerMillion: 0.3,
    tier: '$$',
  },
  'grok-4-fast': {
    modelId: 'grok-4-fast',
    inputCostPerMillion: 0.6,
    outputCostPerMillion: 2.4,
    cachedInputCostPerMillion: 0.06,
    tier: '$',
  },
  'grok-code-fast-1': {
    modelId: 'grok-code-fast-1',
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.6,
    cachedInputCostPerMillion: 0.04,
    tier: '$',
  },
  'grok-3': {
    modelId: 'grok-3',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCostPerMillion: 0.75,
    tier: '$$',
  },
  'grok-3-mini': {
    modelId: 'grok-3-mini',
    inputCostPerMillion: 0.3,
    outputCostPerMillion: 0.5,
    cachedInputCostPerMillion: 0.075,
    tier: '$',
  },

  // =========================================================================
  // Groq Models (Strictly 3 Models)
  // =========================================================================
  'llama-3.3-70b-versatile': {
    modelId: 'llama-3.3-70b-versatile',
    inputCostPerMillion: 0.59,
    outputCostPerMillion: 0.79,
    tier: '$',
  },
  'llama-3.1-8b-instant': {
    modelId: 'llama-3.1-8b-instant',
    inputCostPerMillion: 0.05,
    outputCostPerMillion: 0.08,
    tier: '$',
  },
  'openai/gpt-oss-120b': {
    modelId: 'openai/gpt-oss-120b',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.75,
    tier: '$',
  },
};

/**
 * Retrieves pricing configuration for a specific model ID.
 */
export function getModelPricing(modelId: string): ModelPricing | undefined {
  return MODEL_PRICING_CATALOG[modelId];
}

/**
 * Calculates estimated dollar cost for a model run given token counts.
 * Falls back to balanced daily driver rate if model is uncataloged.
 *
 * @param modelId Model binary identifier
 * @param inputTokens Count of prompt/input tokens
 * @param outputTokens Count of completion/output tokens
 * @param cachedTokens Optional count of cached prompt tokens
 * @returns Estimated cost in USD
 */
export function calculateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0
): number {
  const pricing = getModelPricing(modelId);

  const inputRate = pricing ? pricing.inputCostPerMillion : 2.0;
  const outputRate = pricing ? pricing.outputCostPerMillion : 10.0;
  const cachedRate = pricing?.cachedInputCostPerMillion ?? inputRate * 0.1;

  const validCachedTokens = Math.max(0, Math.min(cachedTokens, inputTokens));
  const uncachedInputTokens = Math.max(0, inputTokens - validCachedTokens);

  const uncachedInputCost = (uncachedInputTokens * inputRate) / 1_000_000;
  const cachedInputCost = (validCachedTokens * cachedRate) / 1_000_000;
  const outputCost = (Math.max(0, outputTokens) * outputRate) / 1_000_000;

  return Number((uncachedInputCost + cachedInputCost + outputCost).toFixed(6));
}
