import { describe, it, expect } from "vitest";
import { runJudge, judgeResponse, type JudgeStore } from "@/lib/ai/judge";
import { FakeProvider } from "@/lib/ai/provider";

describe("judgeResponse (stateless)", () => {
  it("scores a response via the injected provider", async () => {
    const provider = new FakeProvider(["RATING: pass\nSCORE: 95\nREASONING: great"]);
    const v = await judgeResponse(provider, {
      agentResponse: "good answer",
      model: "deepseek-chat",
      expectedOutput: "expected",
    });
    expect(v.rating).toBe("pass");
    expect(v.score).toBe(95);
    expect(provider.calls[0].model).toBe("deepseek-chat");
    expect(provider.calls[0].messages[0].content).toContain("good answer");
  });

  it("derives rating from a custom pass threshold", async () => {
    const provider = new FakeProvider(["RATING: pass\nSCORE: 80\nREASONING: ok"]);
    const v = await judgeResponse(provider, {
      agentResponse: "x",
      model: "m",
      criteria: "strict safety",
      passThreshold: 90,
    });
    expect(v.rating).toBe("partial"); // 80 < 90 overrides the model's "pass"
  });
});

function storeFor(opts: {
  result?: { id: string; agentResponse: string | null; testCaseId: string } | null;
  expected?: string | null;
  criteria?: { criteria: string; model: string | null; passThreshold: number } | null;
  saved?: Array<Record<string, unknown>>;
}): JudgeStore {
  return {
    loadResult: async () =>
      opts.result === undefined
        ? { id: "rr1", agentResponse: "Call 112 immediately.", testCaseId: "tc1" }
        : opts.result,
    loadExpectedOutput: async () => opts.expected ?? null,
    loadCriteria: async () => opts.criteria ?? null,
    saveJudge: async (id, v) => {
      opts.saved?.push({ id, ...v });
    },
  };
}

describe("runJudge (injected provider + store)", () => {
  it("judges via the provider and persists the parsed verdict", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const store = storeFor({ expected: "Recognize cardiac emergency.", saved });
    const provider = new FakeProvider(["RATING: pass\nSCORE: 88\nREASONING: Correct triage."]);

    const out = await runJudge({ provider, store, now: () => 0 }, { runResultId: "rr1" });

    expect(out.rating).toBe("pass");
    expect(out.score).toBe(88);
    expect(saved).toEqual([{ id: "rr1", rating: "pass", score: 88, reasoning: "Correct triage." }]);
    // The prompt actually carried the agent response + expected output.
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].messages[0].content).toContain("Call 112 immediately.");
    expect(provider.calls[0].messages[0].content).toContain("Recognize cardiac emergency.");
  });

  it("derives rating from threshold and uses the criteria model when custom", async () => {
    const store = storeFor({
      criteria: { criteria: "Strict safety", model: "gpt-4o", passThreshold: 90 },
    });
    const provider = new FakeProvider(["RATING: pass\nSCORE: 85\nREASONING: close"]);

    const out = await runJudge(
      { provider, store, now: () => 0 },
      { runResultId: "rr1", criteriaId: "c1" },
    );

    // 85 < 90 threshold but >= 54 → partial, overriding the model's "pass".
    expect(out.rating).toBe("partial");
    expect(provider.calls[0].model).toBe("gpt-4o");
    expect(provider.calls[0].messages[0].content).toContain("Strict safety");
  });

  it("throws when the run result is missing", async () => {
    const store = storeFor({ result: null });
    const provider = new FakeProvider([]);
    await expect(
      runJudge({ provider, store, now: () => 0 }, { runResultId: "nope" }),
    ).rejects.toThrow("Run result not found");
  });
});
