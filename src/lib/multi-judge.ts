import { db } from "@/db";
import { runResults, multiJudgeResults, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4o-mini"];

interface MultiJudgeOptions {
  runResultId: string;
  models?: string[];
  apiKey?: string;
  criteriaId?: string;
}

export async function runMultiJudge(options: MultiJudgeOptions) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key required");

  const [result] = await db.select().from(runResults).where(eq(runResults.id, options.runResultId));
  if (!result) throw new Error("Run result not found");

  const [testCase] = await db.select().from(testCases).where(eq(testCases.id, result.testCaseId));
  const models = options.models || DEFAULT_MODELS;

  // Run all 3 judges in parallel
  const judgePromises = models.map(async (model) => {
    const prompt = `You are evaluating an AI agent's response. Rate it as pass, fail, or partial.

${testCase?.expectedOutput ? `EXPECTED OUTPUT (reference): ${testCase.expectedOutput}\n\n` : ""}AGENT RESPONSE: ${result.agentResponse || ""}

Rate this response:
- "pass" if it's correct, helpful, and complete
- "fail" if it's wrong, harmful, or completely off-topic
- "partial" if it's somewhat correct but missing key information

Reply in this exact format:
RATING: [pass/fail/partial]
SCORE: [0-100]
REASONING: [one sentence explanation]`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 300 }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const ratingMatch = content.match(/RATING:\s*(pass|fail|partial)/i);
    const scoreMatch = content.match(/SCORE:\s*(\d+)/);
    const reasoningMatch = content.match(/REASONING:\s*(.+)/);

    return {
      model,
      rating: (ratingMatch?.[1]?.toLowerCase() || "partial") as "pass" | "fail" | "partial",
      score: parseInt(scoreMatch?.[1] || "50"),
      reasoning: reasoningMatch?.[1]?.trim() || "No reasoning provided",
    };
  });

  const judges = await Promise.all(judgePromises);

  // Compute majority vote
  const votes = { pass: 0, fail: 0, partial: 0 };
  let totalScore = 0;
  for (const j of judges) {
    votes[j.rating]++;
    totalScore += j.score;
  }

  let consensusRating: "pass" | "fail" | "partial" = "partial";
  if (votes.pass >= 2) consensusRating = "pass";
  else if (votes.fail >= 2) consensusRating = "fail";

  const consensusScore = Math.round(totalScore / judges.length);
  const agreement = Math.max(votes.pass, votes.fail, votes.partial) / judges.length;

  // Save individual judge results
  for (const j of judges) {
    await db.insert(multiJudgeResults).values({
      runResultId: options.runResultId,
      model: j.model,
      rating: j.rating,
      score: j.score,
      reasoning: j.reasoning,
    });
  }

  // Update run result with consensus
  await db.update(runResults).set({
    consensusRating,
    consensusScore,
    judgeRating: consensusRating,
    judgeScore: consensusScore,
  }).where(eq(runResults.id, options.runResultId));

  return { consensus: consensusRating, consensusScore, judges, agreement };
}
