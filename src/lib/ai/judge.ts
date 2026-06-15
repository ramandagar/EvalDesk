// ============================================================================
// Judge orchestrator — eval-path code. Pure of IO concerns: the LLM call goes
// through an injected Provider, and persistence goes through an injected
// JudgeStore port. No fetch, no env, no @/db singleton. This is what makes the
// judge fully unit-testable (see judge.test.ts) and what the eval-path guard
// enforces.
//
// The composition root (src/lib/judge.ts wiring wrapper, and later the worker)
// supplies the concrete Provider + Store.
// ============================================================================

import type { Provider } from "./provider";
import {
  buildJudgePrompt,
  parseJudgeResponse,
  deriveRating,
  type Rating,
  type ParsedJudge,
} from "./judge-core";

export interface JudgeStore {
  loadResult(
    id: string,
  ): Promise<{ id: string; agentResponse: string | null; testCaseId: string } | null>;
  loadExpectedOutput(testCaseId: string): Promise<string | null>;
  loadCriteria(
    criteriaId: string,
  ): Promise<{ criteria: string; model: string | null; passThreshold: number } | null>;
  saveJudge(
    runResultId: string,
    verdict: { rating: Rating; score: number; reasoning: string },
  ): Promise<void>;
}

export interface JudgeDeps {
  provider: Provider;
  store: JudgeStore;
  now: () => number;
}

export interface JudgeOptions {
  runResultId: string;
  model?: string;
  criteriaId?: string;
}

export interface JudgeResponseArgs {
  agentResponse: string;
  model: string;
  expectedOutput?: string;
  criteria?: string;
  passThreshold?: number;
}

/**
 * Stateless scoring primitive: judge a single response with an injected
 * provider. No DB. Used by runJudge and by live provider checks.
 */
export async function judgeResponse(
  provider: Provider,
  args: JudgeResponseArgs,
): Promise<ParsedJudge & { rating: Rating }> {
  const prompt = buildJudgePrompt(args.agentResponse, args.expectedOutput ?? "", args.criteria);
  const completion = await provider.complete({
    model: args.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    maxTokens: 300,
  });
  const parsed = parseJudgeResponse(completion.text);
  const rating =
    args.criteria && args.passThreshold !== undefined
      ? deriveRating(parsed.score, args.passThreshold)
      : parsed.rating;
  return { ...parsed, rating };
}

export async function runJudge(
  deps: JudgeDeps,
  options: JudgeOptions,
): Promise<ParsedJudge & { rating: Rating }> {
  const result = await deps.store.loadResult(options.runResultId);
  if (!result) throw new Error("Run result not found");

  const expectedOutput = await deps.store.loadExpectedOutput(result.testCaseId);

  let model = options.model ?? "gpt-4o-mini";
  let criteriaText: string | undefined;
  let passThreshold = 70;
  let custom = false;

  if (options.criteriaId) {
    const criteria = await deps.store.loadCriteria(options.criteriaId);
    if (criteria) {
      custom = true;
      criteriaText = criteria.criteria;
      model = criteria.model ?? model;
      passThreshold = criteria.passThreshold;
    }
  }

  const verdict = await judgeResponse(deps.provider, {
    agentResponse: result.agentResponse ?? "",
    model,
    expectedOutput: expectedOutput ?? undefined,
    criteria: criteriaText,
    passThreshold: custom ? passThreshold : undefined,
  });

  await deps.store.saveJudge(options.runResultId, {
    rating: verdict.rating,
    score: verdict.score,
    reasoning: verdict.reasoning,
  });

  return verdict;
}
