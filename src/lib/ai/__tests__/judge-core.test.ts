import { describe, it, expect } from "vitest";
import { buildJudgePrompt, parseJudgeResponse, deriveRating } from "@/lib/ai/judge-core";

describe("judge-core (pure)", () => {
  describe("parseJudgeResponse", () => {
    it("parses a well-formed judge response", () => {
      const p = parseJudgeResponse("RATING: pass\nSCORE: 92\nREASONING: Correct and complete.");
      expect(p).toEqual({ rating: "pass", score: 92, reasoning: "Correct and complete." });
    });

    it("is case-insensitive on the rating", () => {
      expect(parseJudgeResponse("RATING: FAIL\nSCORE: 10\nREASONING: wrong").rating).toBe("fail");
    });

    it("defaults safely on garbage input", () => {
      const p = parseJudgeResponse("the model rambled without structure");
      expect(p.rating).toBe("partial");
      expect(p.score).toBe(50);
      expect(p.reasoning).toBe("No reasoning provided");
    });
  });

  describe("deriveRating", () => {
    it("passes at or above threshold", () => {
      expect(deriveRating(70, 70)).toBe("pass");
      expect(deriveRating(100, 70)).toBe("pass");
    });
    it("partial between 60% of threshold and threshold", () => {
      expect(deriveRating(45, 70)).toBe("partial"); // >= 42
      expect(deriveRating(42, 70)).toBe("partial");
    });
    it("fails below 60% of threshold", () => {
      expect(deriveRating(41, 70)).toBe("fail");
      expect(deriveRating(0, 70)).toBe("fail");
    });
  });

  describe("buildJudgePrompt", () => {
    it("includes the response and expected output", () => {
      const prompt = buildJudgePrompt("the answer", "the expected", undefined);
      expect(prompt).toContain("the answer");
      expect(prompt).toContain("the expected");
      expect(prompt).toContain("RATING:");
    });

    it("embeds custom criteria when provided", () => {
      const prompt = buildJudgePrompt("resp", "exp", "Score strictly on patient safety");
      expect(prompt).toContain("Score strictly on patient safety");
      expect(prompt).toContain("SCORING CRITERIA");
    });
  });
});
