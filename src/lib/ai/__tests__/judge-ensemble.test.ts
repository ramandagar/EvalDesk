import { describe, it, expect } from "vitest";
import type { Provider, CompletionRequest, CompletionResult } from "../provider";
import type { Rating } from "../judge-core";
import {
  modal,
  ordinalDisagreement,
  consensusOrdinal,
  honestConfidence,
  decideNeedsHuman,
  dedupeSpecs,
  ratingToOrdinal,
  ordinalToRating,
  clamp01,
  runEnsemble,
  type RoutingInputs,
} from "../judge-ensemble";

function judgeText(rating: Rating, score: number): string {
  return `RATING: ${rating}\nSCORE: ${score}\nREASONING: because ${rating}`;
}

/** Provider that answers by model name, optionally cycling samples per model. */
class ModelProvider implements Provider {
  readonly name = "model-router";
  readonly calls: CompletionRequest[] = [];
  constructor(private byModel: Record<string, Array<{ rating: Rating; score: number }>>) {}
  private idx: Record<string, number> = {};
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.calls.push(req);
    const seq = this.byModel[req.model] ?? [{ rating: "partial", score: 50 }];
    const i = this.idx[req.model] ?? 0;
    this.idx[req.model] = i + 1;
    const pick = seq[Math.min(i, seq.length - 1)];
    return { text: judgeText(pick.rating, pick.score), model: req.model };
  }
}

describe("ordinal helpers", () => {
  it("maps ratings to/from ordinals", () => {
    expect(ratingToOrdinal("fail")).toBe(0);
    expect(ratingToOrdinal("partial")).toBe(1);
    expect(ratingToOrdinal("pass")).toBe(2);
    expect(ordinalToRating(0)).toBe("fail");
    expect(ordinalToRating(2)).toBe("pass");
    expect(ordinalToRating(5)).toBe("pass"); // clamped
  });
  it("clamp01", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe("modal", () => {
  it("returns the modal label and vote fraction", () => {
    expect(modal(["pass", "pass", "fail"])).toEqual({ label: "pass", selfConsistency: 2 / 3 });
  });
  it("tie-breaks toward the lower (more conservative) ordinal", () => {
    expect(modal(["pass", "fail"]).label).toBe("fail");
  });
  it("single sample is trivially consistent", () => {
    expect(modal(["partial"])).toEqual({ label: "partial", selfConsistency: 1 });
  });
});

describe("ordinalDisagreement", () => {
  it("0 for a single judge", () => {
    expect(ordinalDisagreement([2])).toBe(0);
  });
  it("pass-vs-fail is the max (1.0) at N=2", () => {
    expect(ordinalDisagreement([2, 0])).toBeCloseTo(1, 10);
  });
  it("pass-vs-partial is half (0.5) at N=2 — non-degenerate", () => {
    expect(ordinalDisagreement([2, 1])).toBeCloseTo(0.5, 10);
  });
  it("mean over all pairs for N>2", () => {
    // pairs: |2-1|/2=.5, |2-0|/2=1, |1-0|/2=.5 → mean = 2/3
    expect(ordinalDisagreement([2, 1, 0])).toBeCloseTo(2 / 3, 10);
  });
});

describe("consensusOrdinal (lower median)", () => {
  it("median of odd count", () => {
    expect(consensusOrdinal([0, 2, 1])).toBe(1);
  });
  it("lower median of even count (conservative)", () => {
    expect(consensusOrdinal([0, 2])).toBe(0);
  });
});

describe("honestConfidence", () => {
  it("weights 0.4 selfReported + 0.4 selfConsistency + 0.2 ensembleAgreement", () => {
    expect(honestConfidence({ selfReported: 1, selfConsistency: 1, ensembleAgreement: 1 })).toBeCloseTo(1, 10);
    expect(honestConfidence({ selfReported: 0, selfConsistency: 0, ensembleAgreement: 0 })).toBe(0);
    expect(honestConfidence({ selfReported: 0.5, selfConsistency: 1, ensembleAgreement: 0 })).toBeCloseTo(0.6, 10);
  });
});

describe("decideNeedsHuman — closed routing loop", () => {
  const baseline: RoutingInputs = {
    confidence: 0.95,
    disagreement: 0,
    disagreementBasis: "computed",
    distinctModels: 2,
    samples: 1,
    tau: 0.7,
    published: true,
    fromRandomAudit: false,
    isAdversarial: false,
    rubricAlwaysHuman: false,
    allowSingleJudgeAutoFinalize: false,
  };

  it("auto-finalizes a confident, agreeing 2-model ensemble", () => {
    const d = decideNeedsHuman(baseline);
    expect(d.needsHuman).toBe(false);
    expect(d.reasons).toEqual([]);
  });
  it("routes on any judge disagreement", () => {
    const d = decideNeedsHuman({ ...baseline, disagreement: 0.5 });
    expect(d.needsHuman).toBe(true);
    expect(d.reasons).toContain("judge-disagreement");
  });
  it("routes on low confidence below τ once published", () => {
    const d = decideNeedsHuman({ ...baseline, confidence: 0.5 });
    expect(d.reasons).toContain("low-confidence");
  });
  it("does NOT apply the confidence gate during cold start (unpublished / τ null)", () => {
    const d = decideNeedsHuman({ ...baseline, confidence: 0.1, published: false, tau: null });
    expect(d.reasons).not.toContain("low-confidence");
    expect(d.needsHuman).toBe(false); // agreeing 2-model ensemble auto-finalizes in cold start
  });
  it("routes a single judge with a single sample by default", () => {
    const d = decideNeedsHuman({ ...baseline, distinctModels: 1, disagreementBasis: "unknown", samples: 1 });
    expect(d.reasons).toContain("single-judge");
  });
  it("single judge can auto-finalize when opted in and confident", () => {
    const d = decideNeedsHuman({
      ...baseline,
      distinctModels: 1,
      disagreementBasis: "unknown",
      samples: 1,
      allowSingleJudgeAutoFinalize: true,
    });
    expect(d.needsHuman).toBe(false);
  });
  it("always routes audit, adversarial, and always-human items", () => {
    expect(decideNeedsHuman({ ...baseline, fromRandomAudit: true }).reasons).toContain("random-audit");
    expect(decideNeedsHuman({ ...baseline, isAdversarial: true }).reasons).toContain("adversarial");
    expect(decideNeedsHuman({ ...baseline, rubricAlwaysHuman: true }).reasons).toContain("rubric-always-human");
  });
});

describe("dedupeSpecs", () => {
  it("collapses duplicate models (first wins) — no fake agreement", () => {
    const out = dedupeSpecs([{ model: "a" }, { model: "b" }, { model: "a" }]);
    expect(out.map((s) => s.model)).toEqual(["a", "b"]);
  });
});

describe("runEnsemble — orchestration", () => {
  const input = { agentResponse: "the answer", expectedOutput: "ref" };

  it("two distinct agreeing models → low disagreement, high confidence, auto-finalize", async () => {
    const provider = new ModelProvider({
      "gpt-4o": [{ rating: "pass", score: 92 }],
      "claude-x": [{ rating: "pass", score: 88 }],
    });
    const r = await runEnsemble(provider, [{ model: "gpt-4o" }, { model: "claude-x" }], input, {
      published: true,
      tau: 0.6,
      selfReported: 0.9,
    });
    expect(r.distinctModels).toBe(2);
    expect(r.disagreementBasis).toBe("computed");
    expect(r.disagreement).toBe(0);
    expect(r.consensusLabel).toBe("pass");
    expect(r.needsHuman).toBe(false);
  });

  it("two models that split pass-vs-fail → max disagreement → routes to human", async () => {
    const provider = new ModelProvider({
      "gpt-4o": [{ rating: "pass", score: 90 }],
      "claude-x": [{ rating: "fail", score: 10 }],
    });
    const r = await runEnsemble(provider, [{ model: "gpt-4o" }, { model: "claude-x" }], input, { published: true, tau: 0.6 });
    expect(r.disagreement).toBeCloseTo(1, 10);
    expect(r.needsHuman).toBe(true);
    expect(r.reasons).toContain("judge-disagreement");
  });

  it("duplicate models collapse to ONE judge with disagreement unknown → routes (single-judge)", async () => {
    const provider = new ModelProvider({ "gpt-4o": [{ rating: "pass", score: 90 }] });
    const r = await runEnsemble(provider, [{ model: "gpt-4o" }, { model: "gpt-4o" }], input, { published: true, tau: 0.6 });
    expect(r.distinctModels).toBe(1);
    expect(r.disagreementBasis).toBe("unknown");
    expect(r.ensembleAgreement).toBe(0.5); // neutral, not fabricated agreement
    expect(r.reasons).toContain("single-judge");
  });

  it("self-consistency from K samples drives confidence; unstable samples lower it", async () => {
    // One model, K=3 samples: pass, pass, fail → modal pass, selfConsistency 2/3.
    const provider = new ModelProvider({
      "gpt-4o": [
        { rating: "pass", score: 90 },
        { rating: "pass", score: 85 },
        { rating: "fail", score: 20 },
      ],
    });
    const r = await runEnsemble(provider, [{ model: "gpt-4o", samples: 3 }], input, {
      published: true,
      tau: 0.6,
      allowSingleJudgeAutoFinalize: true,
      selfReported: 0.5,
    });
    expect(r.perSpec[0].selfConsistency).toBeCloseTo(2 / 3, 10);
    expect(r.consensusLabel).toBe("pass");
    // confidence = 0.4*0.5 + 0.4*(2/3) + 0.2*0.5 = 0.2 + 0.2667 + 0.1 = 0.5667
    expect(r.confidence).toBeCloseTo(0.5667, 3);
  });

  it("tolerates a partially-failing ensemble (one judge throws)", async () => {
    const flaky: Provider = {
      name: "flaky",
      async complete(req) {
        if (req.model === "broken") throw new Error("boom");
        return { text: judgeText("pass", 80), model: req.model };
      },
    };
    const r = await runEnsemble(flaky, [{ model: "good" }, { model: "broken" }], input, {});
    expect(r.distinctModels).toBe(1); // the broken judge was dropped
    expect(r.consensusLabel).toBe("pass");
  });
});
