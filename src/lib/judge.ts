import { db } from "@/db";
import { runResults, judgeCriteria, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";

interface JudgeOptions {
  runResultId: string;
  model?: string;
  apiKey?: string;
  criteriaId?: string; // Custom judge criteria ID
}

export async function llmJudge(options: JudgeOptions) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key required for LLM-as-Judge");
  }

  const [result] = await db.select().from(runResults).where(eq(runResults.id, options.runResultId));
  if (!result) throw new Error("Run result not found");

  // Get the test case for expected output
  const [testCase] = await db.select().from(testCases).where(eq(testCases.id, result.testCaseId));

  // Check for custom criteria
  let customCriteria: any = null;
  let model = options.model || "gpt-4o-mini";
  let passThreshold = 70;

  if (options.criteriaId) {
    const [criteria] = await db.select().from(judgeCriteria).where(eq(judgeCriteria.id, options.criteriaId));
    if (criteria) {
      customCriteria = criteria;
      model = criteria.model || model;
      passThreshold = criteria.passThreshold;
    }
  }

  const prompt = buildJudgePrompt(
    result.agentResponse || "",
    testCase?.expectedOutput || "",
    customCriteria
  );

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 300,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Parse the judge response
  const parsed = parseJudgeResponse(content);

  // Apply custom pass threshold if provided
  const rating = parsed.score >= passThreshold ? "pass" : parsed.score >= passThreshold * 0.6 ? "partial" : "fail";

  await db
    .update(runResults)
    .set({
      judgeRating: customCriteria ? rating : parsed.rating,
      judgeScore: parsed.score,
      judgeReasoning: parsed.reasoning,
    })
    .where(eq(runResults.id, options.runResultId));

  return { ...parsed, rating: customCriteria ? rating : parsed.rating };
}

function buildJudgePrompt(agentResponse: string, expectedOutput: string, customCriteria?: any): string {
  if (customCriteria) {
    return `You are an expert evaluator using custom scoring criteria.

SCORING CRITERIA:
"""
${customCriteria.criteria}
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

function parseJudgeResponse(content: string) {
  const ratingMatch = content.match(/RATING:\s*(pass|fail|partial)/i);
  const scoreMatch = content.match(/SCORE:\s*(\d+)/);
  const reasoningMatch = content.match(/REASONING:\s*(.+)/);

  return {
    rating: (ratingMatch?.[1]?.toLowerCase() || "partial") as "pass" | "fail" | "partial",
    score: parseInt(scoreMatch?.[1] || "50"),
    reasoning: reasoningMatch?.[1]?.trim() || "No reasoning provided",
  };
}
