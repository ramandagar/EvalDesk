// ============================================================================
// Cost estimator — pure function, no IO. Estimates USD cost from token counts
// using a hardcoded per-1k-token price table. Tracks AGENT tokens only (the
// judge runs on the user's own key and is not counted here). Price table covers
// the most common models; unknown models fall back to a conservative default.
// Make it configurable per-project when a buyer asks.
// ============================================================================

/** USD cost per 1 000 tokens for common models (input/output prices). */
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "deepseek-chat": { input: 0.00014, output: 0.00028 },
  "claude-3-5-sonnet": { input: 0.003, output: 0.015 },
};

const DEFAULT_PRICE = { input: 0.001, output: 0.002 };

/**
 * Estimate the USD cost of a single agent call.
 * @param model  The model name (e.g. "gpt-4o-mini").
 * @param tokensIn  Input / prompt tokens consumed.
 * @param tokensOut Output / completion tokens produced.
 * @returns Estimated USD cost (floating-point, may need rounding for display).
 */
export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICES[model] ?? DEFAULT_PRICE;
  return (tokensIn / 1000) * p.input + (tokensOut / 1000) * p.output;
}
