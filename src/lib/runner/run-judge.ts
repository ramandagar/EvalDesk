// ============================================================================
// Run judging — the AI-scoring stage, run by the worker (never on a request
// thread). For each completed run_result it runs the JudgeEnsemble, persists an
// immutable, idempotent ai_scores row per judge, and routes low-confidence /
// disagreeing / audit-sampled results to a human by setting needs_human. The
// AI writes ONLY to the ai_scores layer and the needs_human flag — it never
// writes a verdict. Fully dependency-injected (repos + Provider + clock).
// ============================================================================

import { createHash } from "node:crypto";
import type { Provider } from "@/lib/ai/provider";
import { runEnsemble, type JudgeSpec } from "@/lib/ai/judge-ensemble";
import type { testCasesRepo } from "@/db/repos/test-cases";
import type { runsRepo } from "@/db/repos/runs";
import type { runResultsRepo } from "@/db/repos/run-results";
import type { aiScoresRepo } from "@/db/repos/ai-scores";
import type { rubricsRepo } from "@/db/repos/rubrics";

export interface JudgeRunDeps {
  provider: Provider;
  testCases: ReturnType<typeof testCasesRepo>;
  runs: ReturnType<typeof runsRepo>;
  runResults: ReturnType<typeof runResultsRepo>;
  aiScores: ReturnType<typeof aiScoresRepo>;
  rubrics: ReturnType<typeof rubricsRepo>;
  now: () => number;
}

export interface JudgeRunArgs {
  orgId: string;
  runId: string;
  projectId: string;
  specs: JudgeSpec[]; // judge models (deduped inside the ensemble)
  auditRate?: number; // fraction routed to humans regardless of confidence (default 0.05)
  allowSingleJudgeAutoFinalize?: boolean;
  tau?: number | null; // learned threshold (null during cold start)
  published?: boolean; // is calibration published?
  criteria?: string; // optional custom rubric text for the judge prompt
  passThreshold?: number;
}

export interface JudgeRunSummary {
  runId: string;
  judged: number;
  autoFinalized: number;
  needsHuman: number;
  passCount: number;
  failCount: number;
  partialCount: number;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Deterministic audit-sample membership — no RNG, stable across retries. */
export function isAuditItem(resultId: string, rate: number): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  const bucket = parseInt(sha256(resultId).slice(0, 8), 16) % 1000;
  return bucket < Math.round(rate * 1000);
}

export async function judgeRun(deps: JudgeRunDeps, args: JudgeRunArgs): Promise<JudgeRunSummary> {
  const { orgId, runId, projectId } = args;
  const auditRate = args.auditRate ?? 0.05;
  const rubric = await deps.rubrics.getOrCreateDefault(orgId, projectId, deps.now());
  const results = await deps.runResults.listForRun(orgId, runId);

  let passCount = 0;
  let failCount = 0;
  let partialCount = 0;
  let needsHuman = 0;
  let judged = 0;

  for (const r of results) {
    // Unjudgeable (agent errored / empty) → fail-safe to human review.
    if (r.status !== "completed" || !r.agentResponse) {
      await deps.runResults.update(orgId, r.id, { needsHuman: true });
      needsHuman += 1;
      continue;
    }

    const tc = await deps.testCases.getInOrg(orgId, r.testCaseId);
    const fromRandomAudit = isAuditItem(r.id, auditRate);

    const ensemble = await runEnsemble(
      deps.provider,
      args.specs,
      {
        agentResponse: r.agentResponse,
        expectedOutput: tc?.expectedOutput ?? undefined,
        criteria: args.criteria,
        passThreshold: args.passThreshold,
      },
      {
        tau: args.tau ?? null,
        published: args.published ?? false,
        fromRandomAudit,
        rubricAlwaysHuman: rubric.alwaysHuman,
        allowSingleJudgeAutoFinalize: args.allowSingleJudgeAutoFinalize ?? false,
      },
    );
    judged += 1;

    // Persist one immutable, idempotent ai_score per judge in the ensemble.
    for (const spec of ensemble.perSpec) {
      const idempotencyKey = sha256(`${r.id}|${spec.model}|${rubric.id}`);
      const promptHash = sha256(`${spec.model}|${rubric.id}|${r.agentResponse}|${tc?.expectedOutput ?? ""}`);
      await deps.aiScores.insertIdempotent(orgId, {
        runResultId: r.id,
        provider: deps.provider.name,
        model: spec.model,
        modelResolved: spec.model,
        label: spec.label,
        scoreNum: spec.meanScore,
        confidence: ensemble.confidence,
        selfConsistency: spec.selfConsistency,
        disagreement: ensemble.disagreement,
        rationale: spec.reasoning,
        rubricVersionId: rubric.id,
        promptHash,
        idempotencyKey,
        now: deps.now(),
      });
    }

    await deps.runResults.update(orgId, r.id, { needsHuman: ensemble.needsHuman });
    if (ensemble.needsHuman) {
      needsHuman += 1;
    } else {
      // Auto-finalized on the judges' consensus label.
      if (ensemble.consensusLabel === "pass") passCount += 1;
      else if (ensemble.consensusLabel === "fail") failCount += 1;
      else partialCount += 1;
    }
  }

  const autoFinalized = passCount + failCount + partialCount;
  await deps.runs.update(orgId, runId, {
    status: "completed",
    passCount,
    failCount,
    partialCount,
    unratedCount: needsHuman,
    passRate: autoFinalized > 0 ? Math.round((passCount / autoFinalized) * 100) : null,
    completedAt: deps.now(),
  });

  return { runId, judged, autoFinalized, needsHuman, passCount, failCount, partialCount };
}
