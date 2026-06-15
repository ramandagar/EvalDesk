import { describe, it, expect } from "vitest";
import { calibrate, type CalibrationPair } from "../calibration";

const DAY = 86_400_000;

function pair(p: Partial<CalibrationPair> & Pick<CalibrationPair, "judgeLabel" | "humanLabel">): CalibrationPair {
  return { confidence: 0.9, fromAudit: true, atMs: 1_000_000, ...p };
}

describe("calibrate — cold-start gating", () => {
  it("insufficient audit sample → published=false, tau=null", () => {
    const pairs = Array.from({ length: 10 }, (_, i) => pair({ judgeLabel: i % 3, humanLabel: i % 3 }));
    const r = calibrate(pairs, { k: 3, minAuditN: 50 });
    expect(r.tau).toBeNull();
    expect(r.published).toBe(false);
    expect(r.coldStartReason).toBe("insufficient-audit-sample");
  });

  it("enough audit but kappa below floor → published=false, low-kappa", () => {
    // Judge always says "pass" (2); human cycles → ~chance agreement, kappa≈0.
    const pairs = Array.from({ length: 60 }, (_, i) => pair({ judgeLabel: 2, humanLabel: i % 3 }));
    const r = calibrate(pairs, { k: 3, minAuditN: 50, minKappa: 0.4 });
    expect(r.auditKappa).toBeLessThan(0.4);
    expect(r.tau).toBeNull();
    expect(r.published).toBe(false);
    expect(r.coldStartReason).toBe("low-kappa");
  });
});

describe("calibrate — τ learned from the audit sample only (bias-correction)", () => {
  // Audit sample with confidence-dependent agreement:
  //   30 @ conf 0.9 → all agree
  //   15 @ conf 0.7 → 12 agree, 3 disagree
  //   15 @ conf 0.5 →  9 agree, 6 disagree
  // Cutoff search ascending: 0.5→0.85 (<0.9); 0.7→42/45=0.933 (>=0.9) ⇒ τ=0.7.
  function auditSet(): CalibrationPair[] {
    const out: CalibrationPair[] = [];
    const add = (conf: number, agree: number, disagree: number) => {
      for (let i = 0; i < agree; i++) {
        const l = i % 3;
        out.push(pair({ judgeLabel: l, humanLabel: l, confidence: conf }));
      }
      for (let i = 0; i < disagree; i++) {
        const l = i % 3;
        out.push(pair({ judgeLabel: l, humanLabel: (l + 1) % 3, confidence: conf }));
      }
    };
    add(0.9, 30, 0);
    add(0.7, 12, 3);
    add(0.5, 9, 6);
    return out;
  }

  it("publishes and lands τ at the confidence where audit agreement clears target", () => {
    const r = calibrate(auditSet(), { k: 3, minAuditN: 50, minKappa: 0.4, targetAgreement: 0.9, minTauSupport: 10 });
    expect(r.auditN).toBe(60);
    expect(r.auditKappa).toBeGreaterThan(0.4);
    expect(r.published).toBe(true);
    expect(r.tau).toBeCloseTo(0.7, 10);
  });

  it("τ is unchanged by adding rosy NON-audit traffic (no selection-bias leak)", () => {
    const base = auditSet();
    const rosy: CalibrationPair[] = Array.from({ length: 200 }, (_, i) =>
      pair({ judgeLabel: i % 3, humanLabel: i % 3, confidence: 0.95, fromAudit: false }),
    );
    const r = calibrate([...base, ...rosy], { k: 3, minAuditN: 50, targetAgreement: 0.9, minTauSupport: 10 });
    expect(r.tau).toBeCloseTo(0.7, 10); // identical — τ derives from audit only
    expect(r.auditN).toBe(60);
    expect(r.n).toBe(260);
  });

  it("unattainable target → τ above 1 (route everything, fail-safe)", () => {
    // Even top confidence agrees only 80% → never clears 0.9.
    const pairs: CalibrationPair[] = [];
    for (let i = 0; i < 60; i++) {
      const agree = i % 5 !== 0; // 80% agreement at every confidence
      const l = i % 3;
      pairs.push(pair({ judgeLabel: l, humanLabel: agree ? l : (l + 1) % 3, confidence: 0.9 }));
    }
    const r = calibrate(pairs, { k: 3, minAuditN: 50, minKappa: 0.4, targetAgreement: 0.9 });
    expect(r.published).toBe(true);
    expect(r.tau as number).toBeGreaterThan(1);
  });
});

describe("calibrate — directional bias", () => {
  it("lenient when the judge rates systematically higher than humans", () => {
    const pairs = Array.from({ length: 20 }, () => pair({ judgeLabel: 2, humanLabel: 1 }));
    const r = calibrate(pairs, { k: 3, minAuditN: 1000 });
    expect(r.biasMagnitude).toBeCloseTo(1, 10);
    expect(r.bias).toBe("lenient");
  });
  it("strict when the judge rates systematically lower", () => {
    const pairs = Array.from({ length: 20 }, () => pair({ judgeLabel: 0, humanLabel: 2 }));
    const r = calibrate(pairs, { k: 3, minAuditN: 1000 });
    expect(r.biasMagnitude).toBeCloseTo(-2, 10);
    expect(r.bias).toBe("strict");
  });
  it("balanced when symmetric within the deadband", () => {
    const pairs = [
      pair({ judgeLabel: 2, humanLabel: 1 }),
      pair({ judgeLabel: 0, humanLabel: 1 }),
      pair({ judgeLabel: 1, humanLabel: 1 }),
    ];
    const r = calibrate(pairs, { k: 3, minAuditN: 1000 });
    expect(r.bias).toBe("balanced");
  });
});

describe("calibrate — confusion, agreement, score error", () => {
  it("builds the [judge][human] confusion matrix and overall agreement", () => {
    const pairs = [
      pair({ judgeLabel: 0, humanLabel: 0 }),
      pair({ judgeLabel: 2, humanLabel: 2 }),
      pair({ judgeLabel: 2, humanLabel: 1 }),
    ];
    const r = calibrate(pairs, { k: 3, minAuditN: 1000 });
    expect(r.confusion[0][0]).toBe(1);
    expect(r.confusion[2][2]).toBe(1);
    expect(r.confusion[2][1]).toBe(1);
    expect(r.agreementPct).toBeCloseTo(2 / 3, 10);
  });

  it("meanAbsScoreError uses 0-100 scores when present", () => {
    const pairs = [
      pair({ judgeLabel: 2, humanLabel: 2, judgeScore: 90, humanScore: 80 }),
      pair({ judgeLabel: 1, humanLabel: 1, judgeScore: 60, humanScore: 50 }),
    ];
    const r = calibrate(pairs, { k: 3, minAuditN: 1000 });
    expect(r.scoreErrorBasis).toBe("score");
    expect(r.meanAbsScoreError).toBeCloseTo(10, 10);
  });

  it("falls back to label-index distance when no scores", () => {
    const pairs = [pair({ judgeLabel: 2, humanLabel: 0 }), pair({ judgeLabel: 1, humanLabel: 1 })];
    const r = calibrate(pairs, { k: 3, minAuditN: 1000 });
    expect(r.scoreErrorBasis).toBe("label-index");
    expect(r.meanAbsScoreError).toBeCloseTo((2 + 0) / 2, 10);
  });
});

describe("calibrate — confidence buckets (honesty check)", () => {
  it("places observations in the right bucket, last bucket inclusive of 1.0", () => {
    const pairs = [
      pair({ judgeLabel: 0, humanLabel: 0, confidence: 0.1 }), // [0,0.2)
      pair({ judgeLabel: 0, humanLabel: 1, confidence: 0.3 }), // [0.2,0.4)
      pair({ judgeLabel: 2, humanLabel: 2, confidence: 1.0 }), // [0.8,1] inclusive
    ];
    const r = calibrate(pairs, { k: 3, minAuditN: 1000 });
    expect(r.byConfidenceBucket).toHaveLength(5);
    expect(r.byConfidenceBucket[0]).toMatchObject({ lo: 0, hi: 0.2, n: 1, agreementPct: 1 });
    expect(r.byConfidenceBucket[1]).toMatchObject({ lo: 0.2, hi: 0.4, n: 1, agreementPct: 0 });
    expect(r.byConfidenceBucket[4]).toMatchObject({ lo: 0.8, hi: 1, n: 1, agreementPct: 1 });
  });
});

describe("calibrate — drift windows from epoch-ms", () => {
  it("buckets observations into time windows", () => {
    const t0 = 1_000_000_000;
    const pairs = [
      pair({ judgeLabel: 0, humanLabel: 0, atMs: t0 }),
      pair({ judgeLabel: 1, humanLabel: 1, atMs: t0 + 1000 }),
      pair({ judgeLabel: 2, humanLabel: 1, atMs: t0 + 8 * DAY }), // next 7-day window
    ];
    const r = calibrate(pairs, { k: 3, minAuditN: 1000, driftWindowMs: 7 * DAY });
    expect(r.driftSeries).toHaveLength(2);
    expect(r.driftSeries[0].n).toBe(2);
    expect(r.driftSeries[1].n).toBe(1);
    expect(r.driftSeries[0].windowStart).toBe(t0);
  });
});

describe("calibrate — empty input is defined, never NaN", () => {
  it("returns zeros and an insufficient-audit cold start", () => {
    const r = calibrate([], { k: 3 });
    expect(Number.isNaN(r.agreementPct)).toBe(false);
    expect(r.n).toBe(0);
    expect(r.tau).toBeNull();
    expect(r.coldStartReason).toBe("insufficient-audit-sample");
  });
});
