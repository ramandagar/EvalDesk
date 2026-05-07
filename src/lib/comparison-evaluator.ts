/**
 * Pairwise Comparison Evaluator
 * Compares two responses side-by-side using an LLM judge.
 */

export interface ComparisonResult {
  winner: "A" | "B" | "tie";
  scoreA: number;
  scoreB: number;
  reasoning: string;
  criteriaScores: Record<string, { a: number; b: number }>;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

/**
 * Compare two responses side-by-side using LLM judgment.
 */
export async function compare(params: {
  responseA: string;
  responseB: string;
  input: string;
  criteria: string[];
}): Promise<ComparisonResult> {
  const criteriaList = params.criteria.length > 0
    ? params.criteria
    : ["accuracy", "relevance", "completeness", "clarity"];

  const criteriaText = criteriaList
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  const systemPrompt = `You are an expert AI response evaluator performing a pairwise comparison.
You will be given an input/query and two responses (A and B). Evaluate both responses across the following criteria:

${criteriaText}

For each criterion, score both responses on a scale of 0-100.
Then determine an overall winner based on the aggregate scores.

Return a JSON object with this exact structure:
{
  "winner": "A" | "B" | "tie",
  "scoreA": <overall score for A, 0-100>,
  "scoreB": <overall score for B, 0-100>,
  "reasoning": "<detailed explanation of why you chose the winner>",
  "criteriaScores": {
    "<criterion>": { "a": <score 0-100>, "b": <score 0-100> },
    ...
  }
}`;

  const userPrompt = `## Input/Query:
${params.input}

## Response A:
${params.responseA}

## Response B:
${params.responseB}

Compare both responses across the listed criteria and determine the winner.`;

  const raw = await callOpenAI(systemPrompt, userPrompt);
  const parsed = JSON.parse(raw);

  const scoreA = Math.min(100, Math.max(0, Number(parsed.scoreA) || 0));
  const scoreB = Math.min(100, Math.max(0, Number(parsed.scoreB) || 0));

  let winner: "A" | "B" | "tie" = "tie";
  if (parsed.winner === "A" || parsed.winner === "B") {
    winner = parsed.winner;
  }

  // Build criteria scores map
  const criteriaScores: Record<string, { a: number; b: number }> = {};
  if (parsed.criteriaScores && typeof parsed.criteriaScores === "object") {
    for (const [key, val] of Object.entries(parsed.criteriaScores)) {
      const v = val as { a?: number; b?: number };
      criteriaScores[key] = {
        a: Math.min(100, Math.max(0, Number(v.a) || 0)),
        b: Math.min(100, Math.max(0, Number(v.b) || 0)),
      };
    }
  } else {
    // Fallback if LLM didn't return per-criteria scores
    for (const c of criteriaList) {
      criteriaScores[c] = { a: scoreA, b: scoreB };
    }
  }

  return {
    winner,
    scoreA,
    scoreB,
    reasoning: parsed.reasoning || "No reasoning provided",
    criteriaScores,
  };
}
