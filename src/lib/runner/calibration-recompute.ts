// ============================================================================
// Calibration recompute — worker task. Joins the AI-judge layer (ai_scores)
// with the human layer (human_ratings) on shared run_results across a project,
// builds judge/human pairs on the rubric's shared ordinal scale, runs the pure
// calibration + kappa math, and persists judge_calibration + agreement_metrics.
// Pure of IO except the injected repos/clock. The audit-sample membership is
// recomputed deterministically (no RNG) so τ is learned only from unbiased
// pairs. There is NO path where this writes a verdict.
// ============================================================================

import { calibrate, type CalibrationPair } from "@/lib/moat/calibration";
import { cohensKappa, bootstrapCI } from "@/lib/moat/kappa";
import { isAuditItem } from "./run-judge";
import type { Weighting } from "@/lib/moat/kappa";
import type { runsRepo } from "@/db/repos/runs";
import type { runResultsRepo, RunResult } from "@/db/repos/run-results";
import type { aiScoresRepo } from "@/db/repos/ai-scores";
import type { humanRatingsRepo } from "@/db/repos/human-ratings";
import type { rubricsRepo } from "@/db/repos/rubrics";
import type { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import type { agreementMetricsRepo } from "@/db/repos/agreement-metrics";

export interface CalibrationRecomputeDeps {
  runs: ReturnType<typeof runsRepo>;
  runResults: ReturnType<typeof runResultsRepo>;
  aiScores: ReturnType<typeof aiScoresRepo>;
  humanRatings: ReturnType<typeof humanRatingsRepo>;
  rubrics: ReturnType<typeof rubricsRepo>;
  judgeCalibration: ReturnType<typeof judgeCalibrationRepo>;
  agreementMetrics: ReturnType<typeof agreementMetricsRepo>;
  now: () => number;
}

export interface CalibrationRecomputeArgs {
  orgId: string;
  projectId: string;
  judgeModel?: string; // label for the persisted row (default "ensemble")
  auditRate?: number;
  weighting?: Weighting;
  minAuditN?: number;
  minKappa?: number;
}

export interface CalibrationRecomputeResult {
  persisted: boolean;
  reason?: string;
  pairs: number;
  published?: boolean;
  tau?: number | null;
  kappa?: number;
}

/** Lower-median ordinal — robust consensus across a result's ratings. */
function medianOrdinal(ords: number[]): number {
  const s = [...ords].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export async function recomputeCalibration(
  deps: CalibrationRecomputeDeps,
  args: CalibrationRecomputeArgs,
): Promise<CalibrationRecomputeResult> {
  const { orgId, projectId } = args;
  const auditRate = args.auditRate ?? 0.05;
  const weighting: Weighting = args.weighting ?? "quadratic";
  const judgeModel = args.judgeModel ?? "ensemble";

  const rubric = await deps.rubrics.getActive(orgId, projectId);
  if (!rubric) return { persisted: false, reason: "no-rubric", pairs: 0 };
  const labels = rubric.labels;
  const k = labels.length;
  const idx = (label: string) => labels.indexOf(label);

  // Gather every run_result across the project's runs.
  const runs = await deps.runs.listForProject(orgId, projectId);
  const results: RunResult[] = [];
  for (const run of runs) results.push(...(await deps.runResults.listForRun(orgId, run.id)));
  if (results.length === 0) return { persisted: false, reason: "no-results", pairs: 0 };

  const resultIds = results.map((r) => r.id);
  const byId = new Map(results.map((r) => [r.id, r]));
  const aiByResult = new Map<string, number[]>();
  const aiScoreByResult = new Map<string, number[]>();
  const aiConfByResult = new Map<string, number[]>();
  for (const s of await deps.aiScores.listForResults(orgId, resultIds)) {
    const o = idx(s.label);
    if (o < 0) continue;
    (aiByResult.get(s.runResultId) ?? aiByResult.set(s.runResultId, []).get(s.runResultId)!).push(o);
    if (s.scoreNum != null) (aiScoreByResult.get(s.runResultId) ?? aiScoreByResult.set(s.runResultId, []).get(s.runResultId)!).push(s.scoreNum);
    if (s.confidence != null) (aiConfByResult.get(s.runResultId) ?? aiConfByResult.set(s.runResultId, []).get(s.runResultId)!).push(s.confidence);
  }
  const humanByResult = new Map<string, number[]>();
  const humanScoreByResult = new Map<string, number[]>();
  for (const h of await deps.humanRatings.listCurrentForResults(orgId, resultIds)) {
    const o = idx(h.label);
    if (o < 0) continue;
    (humanByResult.get(h.runResultId) ?? humanByResult.set(h.runResultId, []).get(h.runResultId)!).push(o);
    if (h.scoreNum != null) (humanScoreByResult.get(h.runResultId) ?? humanScoreByResult.set(h.runResultId, []).get(h.runResultId)!).push(h.scoreNum);
  }

  // Pair only results that have BOTH an AI score and a human verdict.
  const pairs: CalibrationPair[] = [];
  for (const id of resultIds) {
    const ai = aiByResult.get(id);
    const human = humanByResult.get(id);
    if (!ai?.length || !human?.length) continue;
    const aiScores = aiScoreByResult.get(id);
    const humanScores = humanScoreByResult.get(id);
    pairs.push({
      judgeLabel: medianOrdinal(ai),
      humanLabel: medianOrdinal(human),
      confidence: aiConfByResult.get(id)?.length ? mean(aiConfByResult.get(id)!) : 0.5,
      fromAudit: isAuditItem(id, auditRate),
      atMs: byId.get(id)!.createdAt,
      judgeScore: aiScores?.length ? mean(aiScores) : undefined,
      humanScore: humanScores?.length ? mean(humanScores) : undefined,
    });
  }

  const report = calibrate(pairs, { k, weighting, minAuditN: args.minAuditN, minKappa: args.minKappa });
  const now = deps.now();

  // Bootstrap CI for the AI-vs-human weighted kappa.
  const ci = bootstrapCI(
    pairs,
    (sample) => cohensKappa(sample.map((p) => [p.judgeLabel, p.humanLabel] as [number, number]), k, weighting).kappa,
    { iterations: 500, seed: 12345 },
  );

  await deps.judgeCalibration.insert(orgId, {
    projectId,
    judgeModel,
    weightingScheme: weighting,
    sampleN: report.n,
    auditSampleN: report.auditN,
    agreementPct: report.agreementPct,
    weightedKappa: report.kappa,
    confusion: report.confusion,
    bias: { bias: report.bias, biasMagnitude: report.biasMagnitude, coldStartReason: report.coldStartReason },
    meanAbsScoreError: report.meanAbsScoreError,
    tau: report.tau,
    published: report.published,
    computedAt: now,
  });

  await deps.agreementMetrics.insert(orgId, {
    scopeType: "project",
    scopeId: projectId,
    rubricVersionId: rubric.id,
    aiHumanAgreementPct: report.agreementPct,
    aiHumanConfusion: report.confusion,
    kappa: report.kappa,
    kappaMethod: "cohen",
    weightingScheme: weighting,
    nItems: report.n,
    nRaters: 2,
    ciLo: report.n > 0 ? ci.lo : null,
    ciHi: report.n > 0 ? ci.hi : null,
    computedAt: now,
  });

  return { persisted: true, pairs: pairs.length, published: report.published, tau: report.tau, kappa: report.kappa };
}
