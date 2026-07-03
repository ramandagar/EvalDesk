// ============================================================================
// RAG citation faithfulness evaluation — pure prompt builder + parser, no IO.
// When a test case has a context field (the source/retrieved docs), the judge
// runs an extra faithfulness check: "is every claim in the agent's answer
// grounded in the context?" Catches hallucinations.
// ============================================================================

export type Faithfulness = "faithful" | "unfaithful" | "partial";

export function buildFaithfulnessPrompt(context: string, agentResponse: string): string {
  return `You are evaluating whether an AI agent's response is FAITHFUL to the provided source context. Every factual claim must be directly supported — no hallucination, no fabrication.

SOURCE CONTEXT:
"""
${context}
"""

AGENT RESPONSE TO EVALUATE:
"""
${agentResponse}
"""

Is every factual claim in the agent response directly supported by the source context?
- "faithful" = all claims grounded in context, no fabrication
- "unfaithful" = contains claims NOT supported by the context (hallucination)
- "partial" = mostly grounded but has minor unsupported additions

Reply in this exact format:
RATING: [faithful/unfaithful/partial]
SCORE: [0-100]
REASONING: [which claims are unsupported, if any — one sentence]`;
}

export function parseFaithfulnessResponse(content: string): { rating: Faithfulness; score: number; reasoning: string } {
  const ratingMatch = content.match(/RATING:\s*(faithful|unfaithful|partial)/i);
  const scoreMatch = content.match(/SCORE:\s*(\d+)/);
  const reasoningMatch = content.match(/REASONING:\s*(.+)/);
  return {
    rating: (ratingMatch?.[1]?.toLowerCase() ?? "partial") as Faithfulness,
    score: parseInt(scoreMatch?.[1] ?? "50", 10),
    reasoning: reasoningMatch?.[1]?.trim() ?? "No reasoning provided",
  };
}
