import { describe, it, expect } from "vitest";
import {
  cohensKappa,
  fleissKappa,
  weightedKappa,
  percentAgreement,
  weightMatrix,
  bootstrapCI,
  landisKoch,
  mulberry32,
} from "../kappa";

describe("weightMatrix", () => {
  it("none = identity-disagreement (1 off-diagonal, 0 on)", () => {
    expect(weightMatrix(3, "none")).toEqual([
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ]);
  });
  it("linear = |i-j|/(k-1)", () => {
    expect(weightMatrix(3, "linear")).toEqual([
      [0, 0.5, 1],
      [0.5, 0, 0.5],
      [1, 0.5, 0],
    ]);
  });
  it("quadratic = (i-j)^2/(k-1)^2", () => {
    expect(weightMatrix(3, "quadratic")).toEqual([
      [0, 0.25, 1],
      [0.25, 0, 0.25],
      [1, 0.25, 0],
    ]);
  });
});

describe("cohensKappa — published worked example", () => {
  // Wikipedia Cohen's kappa example: 50 items, 2 categories.
  // both-yes 20, both-no 15, A-yes/B-no 5, A-no/B-yes 10. kappa = 0.40.
  function wikiPairs(): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < 20; i++) pairs.push([1, 1]); // both yes
    for (let i = 0; i < 15; i++) pairs.push([0, 0]); // both no
    for (let i = 0; i < 5; i++) pairs.push([1, 0]); // A yes, B no
    for (let i = 0; i < 10; i++) pairs.push([0, 1]); // A no, B yes
    return pairs;
  }

  it("matches the canonical 0.40", () => {
    const r = cohensKappa(wikiPairs(), 2);
    expect(r.method).toBe("cohen");
    expect(r.observed).toBeCloseTo(0.7, 10);
    expect(r.expected).toBeCloseTo(0.5, 10);
    expect(r.kappa).toBeCloseTo(0.4, 10);
    expect(r.percentAgreement).toBeCloseTo(0.7, 10);
    expect(r.degenerate).toBeNull();
  });
});

describe("cohensKappa — 3x3 ordinal matrix (hand-computed goldens)", () => {
  // Confusion matrix (A rows, B cols), N=18, marginals all uniform:
  //        B0 B1 B2
  //   A0 [ 5  1  0 ]
  //   A1 [ 1  4  1 ]
  //   A2 [ 0  1  5 ]
  function pairs(): Array<[number, number]> {
    const O = [
      [5, 1, 0],
      [1, 4, 1],
      [0, 1, 5],
    ];
    const out: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let c = 0; c < O[i][j]; c++) out.push([i, j]);
    return out;
  }

  it("unweighted kappa = 0.6667, percentAgreement = 14/18", () => {
    const r = cohensKappa(pairs(), 3);
    expect(r.kappa).toBeCloseTo(2 / 3, 6);
    expect(r.percentAgreement).toBeCloseTo(14 / 18, 10);
  });
  it("linear-weighted kappa = 0.75", () => {
    const r = weightedKappa(pairs(), 3, "linear");
    expect(r.weighting).toBe("linear");
    expect(r.kappa).toBeCloseTo(0.75, 10);
    // percentAgreement stays the plain (unweighted) match rate
    expect(r.percentAgreement).toBeCloseTo(14 / 18, 10);
  });
  it("quadratic-weighted kappa = 0.8333", () => {
    const r = weightedKappa(pairs(), 3, "quadratic");
    expect(r.kappa).toBeCloseTo(5 / 6, 6);
  });
});

describe("fleissKappa — published worked example", () => {
  // Wikipedia Fleiss' kappa example: 10 subjects, 14 raters, 5 categories.
  // Published: kappa ≈ 0.210, Pbar ≈ 0.378, Pe ≈ 0.210.
  const data = [
    [0, 0, 0, 0, 14],
    [0, 2, 6, 4, 2],
    [0, 0, 3, 5, 6],
    [0, 3, 9, 2, 0],
    [2, 2, 8, 1, 1],
    [7, 7, 0, 0, 0],
    [3, 2, 6, 3, 0],
    [2, 5, 3, 2, 2],
    [6, 5, 2, 1, 0],
    [0, 2, 2, 3, 7],
  ];

  it("matches the canonical 0.21", () => {
    const r = fleissKappa(data, 5);
    expect(r.method).toBe("fleiss");
    expect(r.n).toBe(10);
    expect(r.observed).toBeCloseTo(0.378, 3); // Pbar
    expect(r.expected).toBeCloseTo(0.2128, 3); // Pe = sum p_j^2 (p=[20,28,39,21,32]/140)
    expect(r.kappa).toBeCloseTo(0.21, 2);
    expect(r.degenerate).toBeNull();
  });
});

describe("degenerate cases — defined sentinels, never NaN", () => {
  it("cohen: no data → kappa 0, degenerate no-data", () => {
    const r = cohensKappa([], 3);
    expect(Number.isNaN(r.kappa)).toBe(false);
    expect(r.kappa).toBe(0);
    expect(r.degenerate).toBe("no-data");
  });
  it("cohen: all-same-single-category → kappa 1, flagged single-category", () => {
    const r = cohensKappa(
      [
        [2, 2],
        [2, 2],
        [2, 2],
      ],
      3,
    );
    expect(Number.isNaN(r.kappa)).toBe(false);
    expect(r.kappa).toBe(1);
    expect(r.degenerate).toBe("single-category");
  });
  it("fleiss: no valid items → kappa 0, no-data (items with <2 ratings excluded)", () => {
    const r = fleissKappa([[1, 0, 0], [0, 1, 0]], 3); // every item has only 1 rating
    expect(r.n).toBe(0);
    expect(r.kappa).toBe(0);
    expect(r.degenerate).toBe("no-data");
  });
  it("fleiss: all raters/items one category → kappa 1, single-category", () => {
    const r = fleissKappa([[0, 0, 3], [0, 0, 4]], 3);
    expect(r.kappa).toBe(1);
    expect(r.degenerate).toBe("single-category");
  });
});

describe("kappa paradox — high agreement, low kappa is reported honestly", () => {
  // Skewed prevalence: raters agree on 85/100 but mostly on the common class.
  it("returns a low/negative kappa despite high percent agreement", () => {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < 80; i++) pairs.push([1, 1]); // both "yes" (common)
    for (let i = 0; i < 5; i++) pairs.push([0, 0]); // both "no" (rare)
    for (let i = 0; i < 8; i++) pairs.push([1, 0]);
    for (let i = 0; i < 7; i++) pairs.push([0, 1]);
    const r = cohensKappa(pairs, 2);
    expect(r.percentAgreement).toBeCloseTo(0.85, 10);
    expect(r.kappa).toBeLessThan(0.4); // paradox: agreement high, kappa modest
    expect(r.degenerate).toBeNull();
  });
});

describe("percentAgreement (unanimity rate)", () => {
  it("counts items where all raters chose one category", () => {
    const items = [
      [0, 0, 3], // unanimous
      [1, 0, 2], // split
      [0, 0, 2], // unanimous
    ];
    expect(percentAgreement(items)).toBeCloseTo(2 / 3, 10);
  });
});

describe("mulberry32 PRNG is deterministic", () => {
  it("same seed → same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("bootstrapCI", () => {
  it("brackets the point estimate and is reproducible with a fixed seed", () => {
    // 3x3 ordinal pairs from above; bootstrap the unweighted kappa.
    const O = [
      [5, 1, 0],
      [1, 4, 1],
      [0, 1, 5],
    ];
    const items: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let c = 0; c < O[i][j]; c++) items.push([i, j]);
    const stat = (s: Array<[number, number]>) => cohensKappa(s, 3).kappa;

    const ci1 = bootstrapCI(items, stat, { iterations: 500, seed: 7 });
    const ci2 = bootstrapCI(items, stat, { iterations: 500, seed: 7 });
    expect(ci1).toEqual(ci2); // deterministic
    expect(ci1.lo).toBeLessThanOrEqual(ci1.point);
    expect(ci1.hi).toBeGreaterThanOrEqual(ci1.point);
    expect(ci1.point).toBeCloseTo(2 / 3, 6);
  });
  it("empty input → degenerate CI equal to the point", () => {
    const ci = bootstrapCI([], () => 0, { iterations: 100 });
    expect(ci).toEqual({ lo: 0, hi: 0, point: 0, iterations: 0 });
  });
});

describe("landisKoch bands", () => {
  it("maps kappa to strength-of-agreement labels", () => {
    expect(landisKoch(-0.1)).toBe("poor");
    expect(landisKoch(0.1)).toBe("slight");
    expect(landisKoch(0.3)).toBe("fair");
    expect(landisKoch(0.5)).toBe("moderate");
    expect(landisKoch(0.7)).toBe("substantial");
    expect(landisKoch(0.9)).toBe("almost-perfect");
  });
});
