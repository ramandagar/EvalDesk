// ============================================================================
// Adjudication — PURE, zero IO. Derives the FINAL verdict for a result from the
// human layer, with the AI layer recorded only for the gap (AI never overrides
// a human). Encodes principle #3: "AI is a suggestion, never a verdict."
//
// Inter-rater kappa is a DATASET-level statistic (across many results), not a
// per-result one — a single result rated by 2 reviewers has no meaningful kappa.
// So `adjudicate` is per-result (final label + unanimity), and
// `interReviewerKappa` aggregates agreement across results for the AgreementPanel
// and the signed certificate.
// ============================================================================

import { cohensKappa, fleissKappa, type Weighting, type AgreementResult } from "./kappa";

export type AdjudicationMethod = "single-human" | "human-consensus" | "ai-only" | "unresolved";

export interface AdjudicationInput {
  humanOrdinals: number[]; // current human verdicts (category indices)
  k: number; // size of the ordinal label space
  aiConsensusOrdinal?: number; // judge consensus, recorded for the gap only
}

export interface AdjudicationResult {
  finalOrdinal: number | null; // null when unresolved (no human verdict)
  method: AdjudicationMethod;
  tie: boolean; // multi-reviewer modal tie (broken conservatively → lower ordinal)
  nReviewers: number;
  humanDistribution: number[]; // counts per category
  reviewerUnanimous: boolean | null; // all reviewers agreed? (null when <2)
  aiConsensusOrdinal: number | null;
  aiHumanMatch: boolean | null; // did the AI consensus match the final human verdict?
}

function distribution(ordinals: number[], k: number): number[] {
  const d = new Array(k).fill(0);
  for (const o of ordinals) if (o >= 0 && o < k) d[o] += 1;
  return d;
}

/** Modal category; ties broken toward the LOWER ordinal (conservative). */
function modal(dist: number[]): { ordinal: number; tie: boolean } {
  let best = 0;
  let bestN = -1;
  let tie = false;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > bestN) {
      bestN = dist[i];
      best = i;
      tie = false;
    } else if (dist[i] === bestN && dist[i] > 0) {
      tie = true; // a second category ties the max — keep the lower ordinal
    }
  }
  return { ordinal: best, tie };
}

export function adjudicate(input: AdjudicationInput): AdjudicationResult {
  const { humanOrdinals, k } = input;
  const aiConsensus = input.aiConsensusOrdinal ?? null;
  const dist = distribution(humanOrdinals, k);
  const n = humanOrdinals.length;
  const base = { humanDistribution: dist, nReviewers: n, aiConsensusOrdinal: aiConsensus };

  if (n === 0) {
    return {
      ...base,
      finalOrdinal: aiConsensus,
      method: aiConsensus === null ? "unresolved" : "ai-only",
      tie: false,
      reviewerUnanimous: null,
      aiHumanMatch: null,
    };
  }

  if (n === 1) {
    const finalOrdinal = humanOrdinals[0];
    return {
      ...base,
      finalOrdinal,
      method: "single-human",
      tie: false,
      reviewerUnanimous: null,
      aiHumanMatch: aiConsensus === null ? null : aiConsensus === finalOrdinal,
    };
  }

  const { ordinal: finalOrdinal, tie } = modal(dist);
  const reviewerUnanimous = dist.filter((c) => c > 0).length === 1;
  return {
    ...base,
    finalOrdinal,
    method: "human-consensus",
    tie,
    reviewerUnanimous,
    aiHumanMatch: aiConsensus === null ? null : aiConsensus === finalOrdinal,
  };
}

// --- Dataset-scope inter-rater agreement --------------------------------------

export interface ReviewerItem {
  /** Ordinals assigned by each reviewer to this one result. */
  ordinals: number[];
}

/**
 * Inter-rater kappa across results. Cohen when EXACTLY two reviewers rated every
 * item (full overlap); otherwise Fleiss over per-item category counts. Items
 * with fewer than 2 reviewers are excluded (they can't show agreement).
 */
export function interReviewerKappa(items: ReviewerItem[], k: number, weighting: Weighting = "quadratic"): AgreementResult {
  const rated = items.filter((it) => it.ordinals.length >= 2);
  const allExactlyTwo = rated.length > 0 && rated.every((it) => it.ordinals.length === 2);

  if (allExactlyTwo) {
    const pairs = rated.map((it) => [it.ordinals[0], it.ordinals[1]] as [number, number]);
    return cohensKappa(pairs, k, weighting);
  }
  const counts = rated.map((it) => {
    const d = new Array(k).fill(0);
    for (const o of it.ordinals) if (o >= 0 && o < k) d[o] += 1;
    return d;
  });
  return fleissKappa(counts, k);
}
