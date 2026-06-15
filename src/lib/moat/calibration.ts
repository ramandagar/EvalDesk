// ============================================================================
// Judge calibration — PURE math, zero IO. Moat feature #2.
//
// Measures the GAP between the AI judge and human experts on a SHARED ordinal
// label scale, and learns the confidence threshold τ above which the judge may
// auto-finalize. Two anti-circularity rules from ARCHITECTURE.md are encoded:
//
//  1. τ is learned ONLY from a mandatory random AUDIT sample (items routed to
//     humans regardless of confidence), so the estimate isn't biased by the
//     routing policy that produced it (selection-bias circularity).
//  2. COLD START: until the audit sample is large enough AND judge-vs-human
//     agreement clears a floor, τ is undefined and the report is published=false
//     — never shown as trustworthy, never cited in a certificate.
//
// All time bucketing for drift is computed in application code from epoch-ms
// integers (no date_trunc/strftime) so it is identical on SQLite and Postgres.
// ============================================================================

import { cohensKappa, type AgreementResult, type Weighting } from "./kappa";

/** One judge/human paired observation on the same run_result, same rubric. */
export interface CalibrationPair {
  judgeLabel: number; // category index 0..k-1
  humanLabel: number; // category index 0..k-1 (adjudicated/human verdict)
  confidence: number; // honest judge confidence in [0,1]
  fromAudit: boolean; // part of the mandatory random audit sample?
  atMs: number; // epoch-ms the verdict landed
  judgeScore?: number; // optional 0-100 numeric score
  humanScore?: number;
}

export type Bias = "lenient" | "strict" | "balanced";

export interface ConfidenceBucket {
  lo: number;
  hi: number;
  n: number;
  agreementPct: number;
}

export interface DriftWindow {
  windowStart: number;
  windowEnd: number;
  n: number;
  agreementPct: number;
  kappa: number;
}

export type ColdStartReason = null | "insufficient-audit-sample" | "low-kappa";

export interface CalibrationReport {
  n: number; // total paired observations
  auditN: number; // observations from the audit sample
  agreementPct: number; // overall AI-vs-human exact-label agreement
  confusion: number[][]; // [judgeLabel][humanLabel] counts
  kappa: number; // weighted Cohen AI-vs-human (over ALL pairs)
  kappaResult: AgreementResult;
  auditKappa: number; // weighted Cohen over the audit sample only (drives gating)
  bias: Bias;
  biasMagnitude: number; // mean signed (judgeLabel - humanLabel)
  meanAbsScoreError: number; // mean |judgeScore - humanScore| (or label-index distance)
  scoreErrorBasis: "score" | "label-index";
  byConfidenceBucket: ConfidenceBucket[];
  driftSeries: DriftWindow[];
  /** Learned auto-finalize threshold: trust the judge when confidence >= tau.
   *  null during cold start. May exceed 1 ("route everything") if the target
   *  agreement is unattainable even at the top of the confidence range. */
  tau: number | null;
  published: boolean;
  coldStartReason: ColdStartReason;
}

export interface CalibrationOptions {
  k: number; // number of ordinal categories
  weighting?: Weighting; // for AI-vs-human kappa (default quadratic)
  targetAgreement?: number; // agreement the judge must hit above τ (default 0.9)
  minAuditN?: number; // cold-start audit-sample floor (default 50)
  minKappa?: number; // cold-start agreement floor (default 0.4)
  minTauSupport?: number; // min audit items above τ to trust it (default 10)
  bucketEdges?: number[]; // confidence bucket boundaries (default 0,.2,.4,.6,.8,1)
  driftWindowMs?: number; // drift bucket width (default 7 days)
  biasDeadband?: number; // |biasMagnitude| below this is "balanced" (default 0.1)
}

const DAY_MS = 86_400_000;

function buildConfusion(pairs: CalibrationPair[], k: number): number[][] {
  const m = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const p of pairs) m[p.judgeLabel][p.humanLabel] += 1;
  return m;
}

function agreement(pairs: CalibrationPair[]): number {
  if (pairs.length === 0) return 0;
  let hit = 0;
  for (const p of pairs) if (p.judgeLabel === p.humanLabel) hit += 1;
  return hit / pairs.length;
}

/** Smallest confidence cutoff with >= minSupport audit items at/above it whose
 *  agreement clears the target. Returns 1 + epsilon ("route all") if none. */
function learnTau(auditPairs: CalibrationPair[], target: number, minSupport: number): number {
  const cutoffs = Array.from(new Set(auditPairs.map((p) => p.confidence))).sort((a, b) => a - b);
  for (const c of cutoffs) {
    const subset = auditPairs.filter((p) => p.confidence >= c);
    if (subset.length >= minSupport && agreement(subset) >= target) return c;
  }
  return 1.0000001; // unattainable → never auto-finalize (fail-safe)
}

export function calibrate(pairs: CalibrationPair[], opts: CalibrationOptions): CalibrationReport {
  const k = opts.k;
  const weighting = opts.weighting ?? "quadratic";
  const target = opts.targetAgreement ?? 0.9;
  const minAuditN = opts.minAuditN ?? 50;
  const minKappa = opts.minKappa ?? 0.4;
  const minTauSupport = opts.minTauSupport ?? 10;
  const edges = opts.bucketEdges ?? [0, 0.2, 0.4, 0.6, 0.8, 1];
  const driftWindowMs = opts.driftWindowMs ?? 7 * DAY_MS;
  const deadband = opts.biasDeadband ?? 0.1;

  const n = pairs.length;
  const audit = pairs.filter((p) => p.fromAudit);
  const confusion = buildConfusion(pairs, k);

  // AI-vs-human kappa: judge and human are two raters with full overlap → Cohen.
  const allKappa = cohensKappa(pairs.map((p) => [p.judgeLabel, p.humanLabel] as [number, number]), k, weighting);
  const auditKappaRes = cohensKappa(audit.map((p) => [p.judgeLabel, p.humanLabel] as [number, number]), k, weighting);

  // Directional bias from signed label differences (higher index = better rating).
  let signedSum = 0;
  for (const p of pairs) signedSum += p.judgeLabel - p.humanLabel;
  const biasMagnitude = n === 0 ? 0 : signedSum / n;
  const bias: Bias = biasMagnitude > deadband ? "lenient" : biasMagnitude < -deadband ? "strict" : "balanced";

  // Mean absolute score error — prefer real 0-100 scores, else ordinal distance.
  const scored = pairs.filter((p) => p.judgeScore !== undefined && p.humanScore !== undefined);
  let meanAbsScoreError = 0;
  let scoreErrorBasis: "score" | "label-index" = "label-index";
  if (scored.length > 0) {
    scoreErrorBasis = "score";
    meanAbsScoreError = scored.reduce((s, p) => s + Math.abs((p.judgeScore as number) - (p.humanScore as number)), 0) / scored.length;
  } else if (n > 0) {
    meanAbsScoreError = pairs.reduce((s, p) => s + Math.abs(p.judgeLabel - p.humanLabel), 0) / n;
  }

  // Confidence buckets (honesty check): does high-confidence actually agree?
  const byConfidenceBucket: ConfidenceBucket[] = [];
  for (let e = 0; e < edges.length - 1; e++) {
    const lo = edges[e];
    const hi = edges[e + 1];
    const isLast = e === edges.length - 2;
    const subset = pairs.filter((p) => p.confidence >= lo && (isLast ? p.confidence <= hi : p.confidence < hi));
    byConfidenceBucket.push({ lo, hi, n: subset.length, agreementPct: agreement(subset) });
  }

  // Drift windows from epoch-ms (no SQL date functions).
  const driftSeries: DriftWindow[] = [];
  if (n > 0) {
    const minMs = Math.min(...pairs.map((p) => p.atMs));
    const byWindow = new Map<number, CalibrationPair[]>();
    for (const p of pairs) {
      const idx = Math.floor((p.atMs - minMs) / driftWindowMs);
      (byWindow.get(idx) ?? byWindow.set(idx, []).get(idx)!).push(p);
    }
    for (const idx of [...byWindow.keys()].sort((a, b) => a - b)) {
      const ws = byWindow.get(idx)!;
      const windowStart = minMs + idx * driftWindowMs;
      const wk = cohensKappa(ws.map((p) => [p.judgeLabel, p.humanLabel] as [number, number]), k, weighting);
      driftSeries.push({
        windowStart,
        windowEnd: windowStart + driftWindowMs,
        n: ws.length,
        agreementPct: agreement(ws),
        kappa: wk.kappa,
      });
    }
  }

  // Cold-start gating — τ learned from the AUDIT sample only.
  let tau: number | null = null;
  let published = false;
  let coldStartReason: ColdStartReason = null;
  if (audit.length < minAuditN) {
    coldStartReason = "insufficient-audit-sample";
  } else if (auditKappaRes.kappa < minKappa) {
    coldStartReason = "low-kappa";
  } else {
    tau = learnTau(audit, target, minTauSupport);
    published = true;
  }

  return {
    n,
    auditN: audit.length,
    agreementPct: agreement(pairs),
    confusion,
    kappa: allKappa.kappa,
    kappaResult: allKappa,
    auditKappa: auditKappaRes.kappa,
    bias,
    biasMagnitude,
    meanAbsScoreError,
    scoreErrorBasis,
    byConfidenceBucket,
    driftSeries,
    tau,
    published,
    coldStartReason,
  };
}
