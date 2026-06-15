import { describe, it, expect } from "vitest";
import { adjudicate, interReviewerKappa } from "../adjudication";

describe("adjudicate — per result", () => {
  it("unresolved when there is no human verdict and no AI consensus", () => {
    const r = adjudicate({ humanOrdinals: [], k: 3 });
    expect(r.method).toBe("unresolved");
    expect(r.finalOrdinal).toBeNull();
  });

  it("records AI-only when a judge consensus exists but no human has rated", () => {
    const r = adjudicate({ humanOrdinals: [], k: 3, aiConsensusOrdinal: 2 });
    expect(r.method).toBe("ai-only");
    expect(r.finalOrdinal).toBe(2);
    expect(r.aiHumanMatch).toBeNull();
  });

  it("single human verdict wins; AI is only compared, never overrides", () => {
    const r = adjudicate({ humanOrdinals: [0], k: 3, aiConsensusOrdinal: 2 });
    expect(r.method).toBe("single-human");
    expect(r.finalOrdinal).toBe(0); // human fail beats AI pass
    expect(r.aiHumanMatch).toBe(false);
  });

  it("multi-reviewer modal consensus; unanimity detected", () => {
    const r = adjudicate({ humanOrdinals: [2, 2, 1], k: 3, aiConsensusOrdinal: 2 });
    expect(r.method).toBe("human-consensus");
    expect(r.finalOrdinal).toBe(2);
    expect(r.reviewerUnanimous).toBe(false);
    expect(r.aiHumanMatch).toBe(true);
    expect(r.humanDistribution).toEqual([0, 1, 2]);
  });

  it("unanimous reviewers", () => {
    const r = adjudicate({ humanOrdinals: [1, 1, 1], k: 3 });
    expect(r.reviewerUnanimous).toBe(true);
    expect(r.finalOrdinal).toBe(1);
  });

  it("breaks a modal tie toward the lower (conservative) ordinal", () => {
    const r = adjudicate({ humanOrdinals: [2, 0], k: 3 }); // 1 each → tie
    expect(r.tie).toBe(true);
    expect(r.finalOrdinal).toBe(0); // conservative
  });
});

describe("interReviewerKappa — dataset scope", () => {
  it("uses Cohen when exactly two reviewers rated every item", () => {
    // 50-item, 2-category Wikipedia Cohen example → kappa 0.4 (nominal weighting).
    const items = [];
    for (let i = 0; i < 20; i++) items.push({ ordinals: [1, 1] });
    for (let i = 0; i < 15; i++) items.push({ ordinals: [0, 0] });
    for (let i = 0; i < 5; i++) items.push({ ordinals: [1, 0] });
    for (let i = 0; i < 10; i++) items.push({ ordinals: [0, 1] });
    const r = interReviewerKappa(items, 2, "none");
    expect(r.method).toBe("cohen");
    expect(r.kappa).toBeCloseTo(0.4, 10);
  });

  it("uses Fleiss when reviewer counts vary across items", () => {
    const items = [{ ordinals: [2, 2, 1] }, { ordinals: [0, 0] }, { ordinals: [1, 1, 1] }];
    const r = interReviewerKappa(items, 3);
    expect(r.method).toBe("fleiss");
    expect(Number.isNaN(r.kappa)).toBe(false);
  });

  it("excludes single-reviewer items (no agreement possible)", () => {
    const items = [{ ordinals: [2] }, { ordinals: [1, 1] }, { ordinals: [0, 0] }];
    const r = interReviewerKappa(items, 3);
    expect(r.n).toBe(2); // the single-reviewer item dropped
  });
});
