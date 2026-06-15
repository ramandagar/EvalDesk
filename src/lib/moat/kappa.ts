// ============================================================================
// Inter-rater reliability — PURE math, zero IO (no db, fetch, env, clock).
//
// This is moat feature #1: the agreement numbers no incumbent renders. Every
// function here is deterministic and unit-tested against published worked
// examples (Cohen 1960 / Fleiss 1971 / Cohen 1968 weighted) so a regulator can
// reproduce the exact figure that gets frozen into a signed certificate.
//
// Labels are passed as integer category indices 0..k-1. The caller maps the
// rubric's ordered label space (e.g. ["fail","partial","pass"]) onto those
// indices; ordinal weighting (linear/quadratic) assumes that order is the
// scale order. Degenerate inputs return DEFINED sentinels with a `degenerate`
// reason — never NaN — so the UI can suppress or warn instead of rendering junk.
// ============================================================================

export type Weighting = "none" | "linear" | "quadratic";
export type KappaMethod = "cohen" | "fleiss";
export type Degenerate = null | "no-data" | "single-item" | "single-category";

export interface AgreementResult {
  method: KappaMethod;
  weighting: Weighting;
  /** Cohen/Fleiss kappa. 1 for true perfect agreement; 0 when undefined-by-chance. */
  kappa: number;
  /** Observed agreement (weighted when weighting != "none"). */
  observed: number;
  /** Chance-expected agreement. */
  expected: number;
  /** Plain proportion-agreement, always unweighted, for display alongside kappa. */
  percentAgreement: number;
  /** Number of items that contributed (>= 2 ratings each). */
  n: number;
  degenerate: Degenerate;
}

/** Disagreement-weight matrix for k ordinal categories (0 on the diagonal). */
export function weightMatrix(k: number, weighting: Weighting): number[][] {
  const w: number[][] = [];
  const denom = k > 1 ? k - 1 : 1;
  for (let i = 0; i < k; i++) {
    w[i] = [];
    for (let j = 0; j < k; j++) {
      if (weighting === "none") w[i][j] = i === j ? 0 : 1;
      else if (weighting === "linear") w[i][j] = Math.abs(i - j) / denom;
      else w[i][j] = ((i - j) * (i - j)) / (denom * denom); // quadratic
    }
  }
  return w;
}

/**
 * Cohen's kappa for exactly two raters with full overlap. `pairs` is a list of
 * [labelA, labelB] integer category indices, one per co-rated item. `weighting`
 * selects unweighted / linearly / quadratically weighted (Cohen 1968) kappa for
 * an ordinal scale.
 */
export function cohensKappa(pairs: Array<[number, number]>, k: number, weighting: Weighting = "none"): AgreementResult {
  const n = pairs.length;
  const base = (extra: Partial<AgreementResult>): AgreementResult => ({
    method: "cohen",
    weighting,
    kappa: 0,
    observed: 0,
    expected: 0,
    percentAgreement: 0,
    n,
    degenerate: null,
    ...extra,
  });
  if (n === 0) return base({ degenerate: "no-data" });

  // Observed kxk confusion matrix (rater A rows, rater B cols).
  const O: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  let exactMatches = 0;
  for (const [a, b] of pairs) {
    O[a][b] += 1;
    if (a === b) exactMatches += 1;
  }
  const rowSum = O.map((r) => r.reduce((s, v) => s + v, 0));
  const colSum = new Array(k).fill(0);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) colSum[j] += O[i][j];

  const percentAgreement = exactMatches / n;

  // Weighted agreement form: agreement weight a_ij = 1 - d_ij (d = disagreement weight).
  const d = weightMatrix(k, weighting);
  let obsDisagree = 0;
  let expDisagree = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const eij = (rowSum[i] * colSum[j]) / n; // expected count under independence
      obsDisagree += d[i][j] * O[i][j];
      expDisagree += d[i][j] * eij;
    }
  }
  const observed = 1 - obsDisagree / n;
  const expected = 1 - expDisagree / n;

  // Denominator 0 means chance-expected agreement is already perfect — only
  // possible when every rating is the same single category. That IS perfect
  // agreement, but kappa is undefined; report 1 and flag it for suppression.
  if (1 - expected === 0) return base({ observed, expected, percentAgreement, kappa: 1, degenerate: "single-category" });

  const kappa = (observed - expected) / (1 - expected);
  return base({ observed, expected, percentAgreement, kappa });
}

/**
 * Fleiss' kappa for >2 raters, generalized to a variable number of raters per
 * item. `items[i]` is the per-category rating counts for item i (length k);
 * items with fewer than 2 ratings are excluded (can't agree with themselves).
 * Nominal scale — Fleiss is unweighted by construction.
 */
export function fleissKappa(items: number[][], k: number): AgreementResult {
  const base = (extra: Partial<AgreementResult>): AgreementResult => ({
    method: "fleiss",
    weighting: "none",
    kappa: 0,
    observed: 0,
    expected: 0,
    percentAgreement: 0,
    n: 0,
    degenerate: null,
    ...extra,
  });

  const valid = items.filter((counts) => counts.reduce((s, v) => s + v, 0) >= 2);
  const n = valid.length;
  if (n === 0) return base({ n: 0, degenerate: "no-data" });

  const colTotals = new Array(k).fill(0);
  let grandTotal = 0;
  const pPerItem: number[] = [];
  for (const counts of valid) {
    const ni = counts.reduce((s, v) => s + v, 0);
    let sumSq = 0;
    for (let j = 0; j < k; j++) {
      sumSq += counts[j] * counts[j];
      colTotals[j] += counts[j];
      grandTotal += counts[j];
    }
    // Proportion of agreeing rater-pairs for this item.
    pPerItem.push((sumSq - ni) / (ni * (ni - 1)));
  }

  const Pbar = pPerItem.reduce((s, v) => s + v, 0) / n;
  const pj = colTotals.map((t) => t / grandTotal);
  const Pe = pj.reduce((s, p) => s + p * p, 0);

  if (1 - Pe === 0) return base({ n, observed: Pbar, expected: Pe, percentAgreement: Pbar, kappa: 1, degenerate: "single-category" });

  const kappa = (Pbar - Pe) / (1 - Pe);
  return base({ n, observed: Pbar, expected: Pe, percentAgreement: Pbar, kappa });
}

/** Convenience wrapper for weighted Cohen's kappa over an ordinal scale. */
export function weightedKappa(
  pairs: Array<[number, number]>,
  k: number,
  weighting: Exclude<Weighting, "none"> = "linear",
): AgreementResult {
  return cohensKappa(pairs, k, weighting);
}

/** Plain proportion of items where all raters chose the same category. */
export function percentAgreement(items: number[][]): number {
  const valid = items.filter((counts) => counts.reduce((s, v) => s + v, 0) >= 2);
  if (valid.length === 0) return 0;
  let unanimous = 0;
  for (const counts of valid) {
    const nonzero = counts.filter((c) => c > 0).length;
    if (nonzero === 1) unanimous += 1;
  }
  return unanimous / valid.length;
}

// --- Bootstrap confidence interval --------------------------------------------

/** Deterministic PRNG (mulberry32) so CIs are reproducible across engines/runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BootstrapCI {
  lo: number;
  hi: number;
  point: number;
  iterations: number;
}

/**
 * Percentile bootstrap CI for a kappa statistic. `items` are the resampling
 * units (rows). `stat` maps a resampled subset back to a scalar kappa. The RNG
 * is seeded for determinism (no Math.random in the call path). Returns the
 * point estimate plus the [alpha/2, 1-alpha/2] percentile interval.
 */
export function bootstrapCI<T>(
  items: T[],
  stat: (sample: T[]) => number,
  opts: { iterations?: number; seed?: number; alpha?: number } = {},
): BootstrapCI {
  const iterations = opts.iterations ?? 1000;
  const alpha = opts.alpha ?? 0.05;
  const rng = mulberry32(opts.seed ?? 1);
  const point = stat(items);
  const n = items.length;
  if (n === 0) return { lo: point, hi: point, point, iterations: 0 };

  const estimates: number[] = [];
  for (let b = 0; b < iterations; b++) {
    const sample: T[] = new Array(n);
    for (let i = 0; i < n; i++) sample[i] = items[Math.floor(rng() * n)];
    estimates.push(stat(sample));
  }
  estimates.sort((x, y) => x - y);
  const lo = estimates[Math.floor((alpha / 2) * iterations)];
  const hi = estimates[Math.min(iterations - 1, Math.floor((1 - alpha / 2) * iterations))];
  return { lo, hi, point, iterations };
}

// --- Landis–Koch interpretation bands ----------------------------------------

export type AgreementBand = "poor" | "slight" | "fair" | "moderate" | "substantial" | "almost-perfect";

/** Landis & Koch (1977) strength-of-agreement label for a kappa value. */
export function landisKoch(kappa: number): AgreementBand {
  if (kappa < 0) return "poor";
  if (kappa < 0.2) return "slight";
  if (kappa < 0.4) return "fair";
  if (kappa < 0.6) return "moderate";
  if (kappa < 0.8) return "substantial";
  return "almost-perfect";
}
