// ============================================================================
// Judge core — PURE functions (no IO). Prompt construction, response parsing,
// and rating derivation. Fully unit-tested with golden values.
// ============================================================================

export type Rating = "pass" | "fail" | "partial";

export interface ParsedJudge {
  rating: Rating;
  score: number;
  reasoning: string;
}

export function buildJudgePrompt(
  agentResponse: string,
  expectedOutput: string,
  criteria?: string,
): string {
  if (criteria) {
    return `You are an expert evaluator using custom scoring criteria.

SCORING CRITERIA:
"""
${criteria}
"""

${expectedOutput ? `EXPECTED OUTPUT (reference): ${expectedOutput}\n\n` : ""}AGENT RESPONSE TO EVALUATE: ${agentResponse}

Evaluate the agent response strictly using the scoring criteria above.
Give a score from 0-100 and one sentence of reasoning.

Reply in this exact format:
RATING: [pass/fail/partial]
SCORE: [0-100]
REASONING: [one sentence explanation]`;
  }

  return `You are evaluating an AI agent's response. Rate it as pass, fail, or partial.

${expectedOutput ? `EXPECTED OUTPUT (reference): ${expectedOutput}\n\n` : ""}AGENT RESPONSE: ${agentResponse}

Rate this response:
- "pass" if it's correct, helpful, and complete
- "fail" if it's wrong, harmful, or completely off-topic
- "partial" if it's somewhat correct but missing key information

Reply in this exact format:
RATING: [pass/fail/partial]
SCORE: [0-100]
REASONING: [one sentence explanation]`;
}

export function parseJudgeResponse(content: string): ParsedJudge {
  const ratingMatch = content.match(/RATING:\s*(pass|fail|partial)/i);
  const scoreMatch = content.match(/SCORE:\s*(\d+)/);
  const reasoningMatch = content.match(/REASONING:\s*(.+)/);

  return {
    rating: (ratingMatch?.[1]?.toLowerCase() || "partial") as Rating,
    score: parseInt(scoreMatch?.[1] || "50", 10),
    reasoning: reasoningMatch?.[1]?.trim() || "No reasoning provided",
  };
}

/** Derive a categorical rating from a numeric score and a pass threshold. */
export function deriveRating(score: number, passThreshold: number): Rating {
  if (score >= passThreshold) return "pass";
  if (score >= passThreshold * 0.6) return "partial";
  return "fail";
}
