// ============================================================================
// review.settled — recompute the adjudication for a result (and the run's
// counters) after a human verdict lands. Reads the human layer (current
// human_ratings) + AI layer (ai_scores, for the gap only), adjudicates on the
// rubric's shared ordinal scale, and upserts the derived adjudication. The AI
// never overrides a human. Pure of IO except injected repos/clock.
// ============================================================================

import { adjudicate } from "@/lib/moat/adjudication";
import type { runsRepo } from "@/db/repos/runs";
import type { runResultsRepo } from "@/db/repos/run-results";
import type { aiScoresRepo } from "@/db/repos/ai-scores";
import type { humanRatingsRepo } from "@/db/repos/human-ratings";
import type { adjudicationsRepo } from "@/db/repos/adjudications";
import type { rubricsRepo } from "@/db/repos/rubrics";

export interface ReviewSettledDeps {
  runs: ReturnType<typeof runsRepo>;
  runResults: ReturnType<typeof runResultsRepo>;
  aiScores: ReturnType<typeof aiScoresRepo>;
  humanRatings: ReturnType<typeof humanRatingsRepo>;
  adjudications: ReturnType<typeof adjudicationsRepo>;
  rubrics: ReturnType<typeof rubricsRepo>;
  now: () => number;
}

function medianOrdinal(ords: number[]): number {
  const s = [...ords].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

/** Recompute the adjudication for one result + the run's denormalized counters. */
export async function reviewSettled(
  deps: ReviewSettledDeps,
  args: { orgId: string; runResultId: string },
): Promise<{ finalLabel: string | null; method: string }> {
  const { orgId, runResultId } = args;
  const resultRow = await deps.runResults.getInOrg(orgId, runResultId);
  if (!resultRow) return { finalLabel: null, method: "unresolved" };

  const run = await deps.runs.getInOrg(orgId, resultRow.runId);
  if (!run) return { finalLabel: null, method: "unresolved" };
  const rubric = await deps.rubrics.getActive(orgId, run.projectId);
  if (!rubric) return { finalLabel: null, method: "unresolved" };
  const labels = rubric.labels;
  const toOrd = (label: string) => labels.indexOf(label);

  const humans = await deps.humanRatings.listCurrentForResult(orgId, runResultId);
  const humanOrdinals = humans.map((h) => toOrd(h.label)).filter((o) => o >= 0);
  const ais = await deps.aiScores.listForResult(orgId, runResultId);
  const aiOrdinals = ais.map((s) => toOrd(s.label)).filter((o) => o >= 0);
  const aiConsensus = aiOrdinals.length ? medianOrdinal(aiOrdinals) : undefined;

  const adj = adjudicate({ humanOrdinals, k: labels.length, aiConsensusOrdinal: aiConsensus });

  let finalLabel: string | null = null;
  if (adj.finalOrdinal !== null && adj.method !== "ai-only" && adj.method !== "unresolved") {
    finalLabel = labels[adj.finalOrdinal];
    await deps.adjudications.upsert(orgId, {
      runResultId,
      rubricVersionId: rubric.id,
      finalLabel,
      method: adj.method,
      agreementSummary: {
        nReviewers: adj.nReviewers,
        reviewerUnanimous: adj.reviewerUnanimous,
        humanDistribution: adj.humanDistribution,
        aiConsensusOrdinal: adj.aiConsensusOrdinal,
        aiHumanMatch: adj.aiHumanMatch,
        tie: adj.tie,
      },
      now: deps.now(),
    });
    // a human has settled this result → it no longer needs review
    await deps.runResults.update(orgId, runResultId, { needsHuman: false });
  }

  await recomputeRunCounters(deps, orgId, run.id, labels);
  return { finalLabel, method: adj.method };
}

/** Roll up adjudicated final labels into the run's denormalized counters. */
async function recomputeRunCounters(deps: ReviewSettledDeps, orgId: string, runId: string, labels: string[]): Promise<void> {
  const results = await deps.runResults.listForRun(orgId, runId);
  const adjs = await deps.adjudications.listForResults(orgId, results.map((r) => r.id));
  const finalByResult = new Map(adjs.map((a) => [a.runResultId, a.finalLabel]));

  let passCount = 0;
  let failCount = 0;
  let partialCount = 0;
  let unrated = 0;
  for (const r of results) {
    const fl = finalByResult.get(r.id);
    if (!fl) {
      unrated += 1;
      continue;
    }
    if (fl === "pass") passCount += 1;
    else if (fl === "fail") failCount += 1;
    else partialCount += 1;
  }
  const adjudicated = passCount + failCount + partialCount;
  void labels;
  await deps.runs.update(orgId, runId, {
    passCount,
    failCount,
    partialCount,
    unratedCount: unrated,
    passRate: adjudicated > 0 ? Math.round((passCount / adjudicated) * 100) : null,
  });
}
