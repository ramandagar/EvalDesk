import { describe, it, expect } from "vitest";
import { estimateCost } from "../cost-tracker";

describe("estimateCost", () => {
  it("gpt-4o-mini: 1 000 input + 500 output → correct USD", () => {
    // input: (1000/1000) * 0.00015 = 0.00015
    // output: (500/1000) * 0.0006  = 0.0003
    // total: 0.00045
    expect(estimateCost("gpt-4o-mini", 1000, 500)).toBeCloseTo(0.00045, 8);
  });

  it("gpt-4o: 2 000 input + 1 000 output → correct USD", () => {
    // input: (2000/1000) * 0.0025 = 0.005
    // output: (1000/1000) * 0.01  = 0.01
    // total: 0.015
    expect(estimateCost("gpt-4o", 2000, 1000)).toBeCloseTo(0.015, 8);
  });

  it("deepseek-chat: 5 000 input + 2 000 output → correct USD", () => {
    // input: 5 * 0.00014  = 0.0007
    // output: 2 * 0.00028 = 0.00056
    // total: 0.00126
    expect(estimateCost("deepseek-chat", 5000, 2000)).toBeCloseTo(0.00126, 8);
  });

  it("unknown model → uses DEFAULT_PRICE (0.001 input, 0.002 output)", () => {
    // input: (1000/1000) * 0.001 = 0.001
    // output: (1000/1000) * 0.002 = 0.002
    // total: 0.003
    expect(estimateCost("some-unknown-model-xyz", 1000, 1000)).toBeCloseTo(0.003, 8);
  });

  it("zero tokens → zero cost", () => {
    expect(estimateCost("gpt-4o", 0, 0)).toBe(0);
    expect(estimateCost("gpt-4o-mini", 0, 0)).toBe(0);
  });

  it("result is always non-negative", () => {
    expect(estimateCost("gpt-4o-mini", 100, 50)).toBeGreaterThan(0);
  });
});
