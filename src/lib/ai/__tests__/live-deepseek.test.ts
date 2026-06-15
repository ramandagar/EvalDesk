import { describe, it, expect } from "vitest";
import { resolveProvider, defaultModelFor } from "@/lib/provider-factory";
import { judgeResponse } from "@/lib/ai/judge";

// Live integration check against the real DeepSeek API. Runs ONLY when both
// DEEPSEEK_API_KEY and DEEPSEEK_LIVE are set (so normal CI/dev runs skip it and
// never spend tokens). Verifies the full path: factory -> provider -> real
// model -> parsed verdict.
const LIVE = !!process.env.DEEPSEEK_API_KEY && !!process.env.DEEPSEEK_LIVE;

describe.skipIf(!LIVE)("DeepSeek live judge", () => {
  it(
    "judges a correct answer as pass",
    async () => {
      const provider = resolveProvider({ name: "deepseek" });
      const verdict = await judgeResponse(provider, {
        agentResponse: "Paris is the capital of France.",
        expectedOutput: "The capital of France is Paris.",
        model: defaultModelFor("deepseek"),
      });
      // eslint-disable-next-line no-console
      console.log("DeepSeek verdict:", verdict);
      expect(["pass", "fail", "partial"]).toContain(verdict.rating);
      expect(verdict.score).toBeGreaterThanOrEqual(0);
      expect(verdict.score).toBeLessThanOrEqual(100);
      expect(verdict.rating).toBe("pass");
    },
    30_000,
  );
});
