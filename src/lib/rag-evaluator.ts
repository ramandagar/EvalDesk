/**
 * RAG Evaluation Metrics
 * Computes faithfulness, relevance, and context recall using OpenAI.
 */

interface RAGScores {
  faithfulness: number;
  relevance: number;
  contextRecall: number;
  overall: number;
  faithfulnessReasoning: string;
  relevanceReasoning: string;
  contextRecallReasoning: string;
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
 * Faithfulness: Does the response stick to the provided context?
 * Checks if claims in the response are grounded in the context.
 */
export async function faithfulness(
  context: string,
  response: string
): Promise<{ score: number; reasoning: string }> {
  const systemPrompt = `You are an expert RAG evaluator. Your task is to evaluate the FAITHFULNESS of a response to the provided context.
Faithfulness measures whether the response is grounded in and consistent with the provided context — it should not introduce information not supported by the context.

Evaluate on a scale of 0.0 to 1.0:
- 1.0: All claims in the response are directly supported by the context
- 0.7-0.9: Most claims are supported, minor unsupported details
- 0.4-0.6: Some claims are supported, noticeable hallucination
- 0.0-0.3: Most claims are not supported by the context

Return a JSON object with:
{ "score": <number 0-1>, "reasoning": "<brief explanation>" }`;

  const userPrompt = `## Context:
${context}

## Response:
${response}

Evaluate the faithfulness of the response to the context.`;

  const raw = await callOpenAI(systemPrompt, userPrompt);
  const parsed = JSON.parse(raw);
  return {
    score: Math.min(1, Math.max(0, Number(parsed.score) || 0)),
    reasoning: parsed.reasoning || "",
  };
}

/**
 * Relevance: Is the response relevant to the input query?
 * Checks if the response actually addresses what was asked.
 */
export async function relevance(
  query: string,
  response: string
): Promise<{ score: number; reasoning: string }> {
  const systemPrompt = `You are an expert RAG evaluator. Your task is to evaluate the RELEVANCE of a response to the given query.
Relevance measures whether the response actually addresses the user's query and provides useful information.

Evaluate on a scale of 0.0 to 1.0:
- 1.0: Response directly and completely addresses the query
- 0.7-0.9: Response mostly addresses the query with some tangential information
- 0.4-0.6: Response partially addresses the query but misses key aspects
- 0.0-0.3: Response does not address the query

Return a JSON object with:
{ "score": <number 0-1>, "reasoning": "<brief explanation>" }`;

  const userPrompt = `## Query:
${query}

## Response:
${response}

Evaluate the relevance of the response to the query.`;

  const raw = await callOpenAI(systemPrompt, userPrompt);
  const parsed = JSON.parse(raw);
  return {
    score: Math.min(1, Math.max(0, Number(parsed.score) || 0)),
    reasoning: parsed.reasoning || "",
  };
}

/**
 * Context Recall: Does the context cover the expected answer?
 * Measures whether the retrieved context contains the information needed to answer.
 */
export async function contextRecall(
  context: string,
  expectedAnswer: string
): Promise<{ score: number; reasoning: string }> {
  const systemPrompt = `You are an expert RAG evaluator. Your task is to evaluate CONTEXT RECALL.
Context recall measures whether the provided context contains the information needed to produce the expected answer.

Evaluate on a scale of 0.0 to 1.0:
- 1.0: Context fully covers all information in the expected answer
- 0.7-0.9: Context covers most of the expected answer
- 0.4-0.6: Context covers some parts of the expected answer but misses important aspects
- 0.0-0.3: Context does not contain the information in the expected answer

Return a JSON object with:
{ "score": <number 0-1>, "reasoning": "<brief explanation>" }`;

  const userPrompt = `## Context:
${context}

## Expected Answer:
${expectedAnswer}

Evaluate whether the context covers the information needed for the expected answer.`;

  const raw = await callOpenAI(systemPrompt, userPrompt);
  const parsed = JSON.parse(raw);
  return {
    score: Math.min(1, Math.max(0, Number(parsed.score) || 0)),
    reasoning: parsed.reasoning || "",
  };
}

/**
 * Run all RAG evaluation metrics in parallel.
 */
export async function evaluateRAG(params: {
  context: string;
  response: string;
  query: string;
  expectedAnswer?: string;
}): Promise<RAGScores> {
  const [faith, rel, recall] = await Promise.all([
    faithfulness(params.context, params.response),
    relevance(params.query, params.response),
    params.expectedAnswer
      ? contextRecall(params.context, params.expectedAnswer)
      : Promise.resolve({ score: 0, reasoning: "No expected answer provided — skipped" }),
  ]);

  const overall =
    params.expectedAnswer
      ? (faith.score * 0.4 + rel.score * 0.3 + recall.score * 0.3)
      : (faith.score * 0.55 + rel.score * 0.45);

  return {
    faithfulness: faith.score,
    relevance: rel.score,
    contextRecall: recall.score,
    overall,
    faithfulnessReasoning: faith.reasoning,
    relevanceReasoning: rel.reasoning,
    contextRecallReasoning: recall.reasoning,
  };
}
