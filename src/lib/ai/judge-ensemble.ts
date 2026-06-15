// ============================================================================
// Judge ensemble & honest confidence — eval-path code (no IO except via the
// injected Provider). This replaces the legacy multi-judge.ts whose
// DEFAULT_MODELS = ["gpt-4o-mini","gpt-4o","gpt-4o-mini"] reported a majority
// fraction over TWO IDENTICAL models as "agreement". Here:
//
//  * Models are deduped; an ensemble needs >= 2 DISTINCT models or it degrades
//    to a single judge with disagreement = "unknown" (never fake agreement).
//  * Disagreement = mean pairwise ORDINAL distance on {fail=0,partial=1,pass=2}
//    normalized to [0,1] — non-degenerate at N=2 (pass-vs-fail routes harder
//    than pass-vs-partial), unlike the legacy 1 - modal/N.
//  * Confidence is COMPUTED, never the model's self-reported token alone:
//    clamp(0.4·selfReported + 0.4·selfConsistency + 0.2·ensembleAgreement).
//    The empirical terms (K-sample stability, cross-judge agreement) dominate.
//  * needsHuman closes the routing loop into the annotation queue.
//
// Pure scoring helpers are exported for golden unit tests; runEnsemble is the
// orchestrator that calls the injected Provider.
// ============================================================================

import type { Provider } from "./provider";
import { judgeResponse } from "./judge";
import type { Rating } from "./judge-core";

/** Ordinal scale shared with the rubric label space and the kappa/calibration math. */
export const ORDINAL: Record<Rating, number> = { fail: 0, partial: 1, pass: 2 };
export const ORDINAL_LABELS: Rating[] = ["fail", "partial", "pass"];
export const SCALE_K = 3;

export function ratingToOrdinal(r: Rating): number {
  return ORDINAL[r];
}
export function ordinalToRating(o: number): Rating {
  return ORDINAL_LABELS[Math.max(0, Math.min(SCALE_K - 1, o))];
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Modal label across K samples + the modal-vote fraction (self-consistency). */
export function modal(ratings: Rating[]): { label: Rating; selfConsistency: number } {
  if (ratings.length === 0) return { label: "partial", selfConsistency: 0 };
  const counts = new Map<Rating, number>();
  for (const r of ratings) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best: Rating = ratings[0];
  let bestN = 0;
  // Deterministic tie-break: prefer the lower ordinal (more conservative).
  for (const label of ORDINAL_LABELS) {
    const n = counts.get(label) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = label;
    }
  }
  return { label: best, selfConsistency: bestN / ratings.length };
}

/** Mean pairwise normalized ordinal distance across judges. [0,1]; 0 if <2 judges. */
export function ordinalDisagreement(ordinals: number[], k = SCALE_K): number {
  const n = ordinals.length;
  if (n < 2) return 0;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sum += Math.abs(ordinals[i] - ordinals[j]) / (k - 1);
      pairs += 1;
    }
  }
  return sum / pairs;
}

/** Lower-median ordinal across judges — a robust, conservative consensus. */
export function consensusOrdinal(ordinals: number[]): number {
  if (ordinals.length === 0) return ORDINAL.partial;
  const sorted = [...ordinals].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2); // lower median for even counts
  return sorted[mid];
}

export function honestConfidence(parts: {
  selfReported: number;
  selfConsistency: number;
  ensembleAgreement: number;
}): number {
  return clamp01(0.4 * parts.selfReported + 0.4 * parts.selfConsistency + 0.2 * parts.ensembleAgreement);
}

export interface RoutingInputs {
  confidence: number;
  disagreement: number;
  disagreementBasis: "computed" | "unknown";
  distinctModels: number;
  samples: number;
  tau: number | null;
  published: boolean;
  fromRandomAudit: boolean;
  isAdversarial: boolean;
  rubricAlwaysHuman: boolean;
  allowSingleJudgeAutoFinalize: boolean;
}

export interface RoutingDecision {
  needsHuman: boolean;
  reasons: string[];
}

/** The closed routing loop. Any reason firing routes the item to a human. */
export function decideNeedsHuman(r: RoutingInputs): RoutingDecision {
  const reasons: string[] = [];
  if (r.rubricAlwaysHuman) reasons.push("rubric-always-human");
  if (r.fromRandomAudit) reasons.push("random-audit");
  if (r.isAdversarial) reasons.push("adversarial");
  if (r.disagreementBasis === "computed" && r.disagreement > 0) reasons.push("judge-disagreement");
  // Single judge with a single sample is never trusted unless explicitly opted in.
  if (r.distinctModels < 2 && r.samples < 2 && !r.allowSingleJudgeAutoFinalize) reasons.push("single-judge");
  // Confidence gate only applies once calibration is published with a learned τ.
  if (r.published && r.tau !== null && r.confidence < r.tau) reasons.push("low-confidence");
  return { needsHuman: reasons.length > 0, reasons };
}

// --- Orchestration ------------------------------------------------------------

export interface JudgeSpec {
  model: string;
  samples?: number; // K (default 1)
  temperature?: number; // used when samples>1 (default 0.7)
}

export interface JudgeInput {
  agentResponse: string;
  expectedOutput?: string;
  criteria?: string;
  passThreshold?: number;
}

export interface SpecResult {
  model: string;
  label: Rating;
  ordinal: number;
  meanScore: number;
  selfConsistency: number;
  samples: number;
  reasoning: string;
}

export interface EnsembleResult {
  perSpec: SpecResult[];
  distinctModels: number;
  consensusLabel: Rating;
  consensusOrdinal: number;
  meanScore: number;
  disagreement: number;
  disagreementBasis: "computed" | "unknown";
  selfConsistency: number;
  ensembleAgreement: number;
  selfReported: number;
  confidence: number;
}

export interface EnsembleRouting {
  tau?: number | null;
  published?: boolean;
  fromRandomAudit?: boolean;
  isAdversarial?: boolean;
  rubricAlwaysHuman?: boolean;
  allowSingleJudgeAutoFinalize?: boolean;
  /** Per-judge self-reported confidence in [0,1] when available (default 0.5 neutral). */
  selfReported?: number;
}

/** Run one judge spec K times (K>1 → sampled at temperature) and reduce to a modal label. */
export async function runJudgeSpec(provider: Provider, spec: JudgeSpec, input: JudgeInput): Promise<SpecResult> {
  const samples = Math.max(1, spec.samples ?? 1);
  const ratings: Rating[] = [];
  const scores: number[] = [];
  let reasoning = "";
  for (let i = 0; i < samples; i++) {
    const v = await judgeResponse(provider, {
      agentResponse: input.agentResponse,
      model: spec.model,
      expectedOutput: input.expectedOutput,
      criteria: input.criteria,
      passThreshold: input.passThreshold,
    });
    ratings.push(v.rating);
    scores.push(v.score);
    if (i === 0) reasoning = v.reasoning;
  }
  const { label, selfConsistency } = modal(ratings);
  return {
    model: spec.model,
    label,
    ordinal: ratingToOrdinal(label),
    meanScore: scores.reduce((s, v) => s + v, 0) / scores.length,
    selfConsistency,
    samples,
    reasoning,
  };
}

/** Dedupe specs by model (first occurrence wins) — fake agreement is impossible. */
export function dedupeSpecs(specs: JudgeSpec[]): JudgeSpec[] {
  const seen = new Set<string>();
  const out: JudgeSpec[] = [];
  for (const s of specs) {
    if (seen.has(s.model)) continue;
    seen.add(s.model);
    out.push(s);
  }
  return out;
}

export async function runEnsemble(
  provider: Provider,
  specs: JudgeSpec[],
  input: JudgeInput,
  routing: EnsembleRouting = {},
): Promise<EnsembleResult & RoutingDecision> {
  const distinct = dedupeSpecs(specs);
  if (distinct.length === 0) throw new Error("runEnsemble requires at least one judge spec");

  // Partial-failure tolerant: a judge that throws is dropped, not fatal.
  const settled = await Promise.allSettled(distinct.map((s) => runJudgeSpec(provider, s, input)));
  const perSpec = settled.filter((r): r is PromiseFulfilledResult<SpecResult> => r.status === "fulfilled").map((r) => r.value);
  if (perSpec.length === 0) throw new Error("all judges failed");

  const distinctModels = perSpec.length;
  const ordinals = perSpec.map((s) => s.ordinal);
  const cOrdinal = consensusOrdinal(ordinals);
  const consensusLabel = ordinalToRating(cOrdinal);

  const disagreementBasis: "computed" | "unknown" = distinctModels >= 2 ? "computed" : "unknown";
  const disagreement = ordinalDisagreement(ordinals);
  const ensembleAgreement = disagreementBasis === "computed" ? 1 - disagreement : 0.5; // neutral when unknown
  const selfConsistency = perSpec.reduce((s, v) => s + v.selfConsistency, 0) / distinctModels;
  const selfReported = routing.selfReported ?? 0.5;
  const meanScore = perSpec.reduce((s, v) => s + v.meanScore, 0) / distinctModels;
  const maxSamples = Math.max(...perSpec.map((s) => s.samples));

  const confidence = honestConfidence({ selfReported, selfConsistency, ensembleAgreement });

  const decision = decideNeedsHuman({
    confidence,
    disagreement,
    disagreementBasis,
    distinctModels,
    samples: maxSamples,
    tau: routing.tau ?? null,
    published: routing.published ?? false,
    fromRandomAudit: routing.fromRandomAudit ?? false,
    isAdversarial: routing.isAdversarial ?? false,
    rubricAlwaysHuman: routing.rubricAlwaysHuman ?? false,
    allowSingleJudgeAutoFinalize: routing.allowSingleJudgeAutoFinalize ?? false,
  });

  return {
    perSpec,
    distinctModels,
    consensusLabel,
    consensusOrdinal: cOrdinal,
    meanScore,
    disagreement,
    disagreementBasis,
    selfConsistency,
    ensembleAgreement,
    selfReported,
    confidence,
    ...decision,
  };
}
