// Cost computation helpers for EvalDesk

export interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "gpt-4-turbo": { inputPer1k: 0.01, outputPer1k: 0.03 },
  "gpt-4": { inputPer1k: 0.03, outputPer1k: 0.06 },
  "gpt-3.5-turbo": { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  "claude-3.5-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-opus": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "claude-3-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-haiku": { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  "claude-4-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "gemini-1.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.005 },
  "gemini-1.5-flash": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  "gemini-pro": { inputPer1k: 0.00025, outputPer1k: 0.0005 },
  "llama-3.1-70b": { inputPer1k: 0.0006, outputPer1k: 0.0008 },
  "llama-3.1-8b": { inputPer1k: 0.00005, outputPer1k: 0.00008 },
  "mistral-large": { inputPer1k: 0.002, outputPer1k: 0.006 },
  "mistral-medium": { inputPer1k: 0.0015, outputPer1k: 0.0045 },
  "mistral-small": { inputPer1k: 0.0002, outputPer1k: 0.0006 },
};

/**
 * Get pricing for a model. Returns null for unknown models.
 */
export function getModelPricing(model: string): ModelPricing | null {
  // Try exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Try case-insensitive partial match
  const lower = model.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (lower.includes(key) || key.includes(lower)) return pricing;
  }

  return null;
}

/**
 * Calculate cost from token counts and model pricing.
 * Falls back to project-level pricing or a default rate.
 */
export function computeRunCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  projectInputPer1k?: number | null,
  projectOutputPer1k?: number | null
): number {
  // Use project-level pricing if set
  if (projectInputPer1k != null && projectOutputPer1k != null) {
    return (inputTokens / 1000) * projectInputPer1k + (outputTokens / 1000) * projectOutputPer1k;
  }

  const pricing = getModelPricing(model);
  if (pricing) {
    return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
  }

  // Default fallback: $0.002/1k input, $0.008/1k output
  const defaultPricing: ModelPricing = { inputPer1k: 0.002, outputPer1k: 0.008 };
  return (inputTokens / 1000) * defaultPricing.inputPer1k + (outputTokens / 1000) * defaultPricing.outputPer1k;
}

export interface CostAggregate {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  runCount: number;
}

/**
 * Aggregate costs across an array of run records.
 */
export function aggregateCosts(runs: Array<{
  totalCost: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
}>): CostAggregate {
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const run of runs) {
    totalCost += run.totalCost ?? 0;
    totalInputTokens += run.totalInputTokens ?? 0;
    totalOutputTokens += run.totalOutputTokens ?? 0;
  }

  return {
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    runCount: runs.length,
  };
}

/**
 * Format cost for display.
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count for display.
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}
