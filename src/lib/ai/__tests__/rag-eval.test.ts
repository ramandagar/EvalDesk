import { describe, it, expect } from "vitest";
import { buildFaithfulnessPrompt, parseFaithfulnessResponse } from "../rag-eval";

describe("RAG faithfulness eval — prompt builder + response parser", () => {
  describe("buildFaithfulnessPrompt", () => {
    it("produces a prompt containing the context and agent response", () => {
      const prompt = buildFaithfulnessPrompt("The sky is blue.", "The sky is blue and beautiful.");
      expect(prompt).toContain("The sky is blue.");
      expect(prompt).toContain("The sky is blue and beautiful.");
      expect(prompt).toContain("FAITHFUL");
      expect(prompt).toContain("RATING:");
      expect(prompt).toContain("SCORE:");
      expect(prompt).toContain("REASONING:");
    });

    it("handles empty context and response gracefully", () => {
      const prompt = buildFaithfulnessPrompt("", "");
      expect(prompt).toContain("SOURCE CONTEXT:");
      expect(prompt).toContain("AGENT RESPONSE TO EVALUATE:");
    });
  });

  describe("parseFaithfulnessResponse", () => {
    it("extracts a faithful rating with score and reasoning", () => {
      const raw = "RATING: faithful\nSCORE: 95\nREASONING: All claims are directly supported by the source context.";
      const result = parseFaithfulnessResponse(raw);
      expect(result.rating).toBe("faithful");
      expect(result.score).toBe(95);
      expect(result.reasoning).toBe("All claims are directly supported by the source context.");
    });

    it("extracts an unfaithful rating with fabricated claims reasoning", () => {
      const raw = "RATING: unfaithful\nSCORE: 10\nREASONING: The agent claims the company was founded in 2010 but the context says 2015.";
      const result = parseFaithfulnessResponse(raw);
      expect(result.rating).toBe("unfaithful");
      expect(result.score).toBe(10);
      expect(result.reasoning).toContain("2010");
    });

    it("extracts a partial rating", () => {
      const raw = "RATING: partial\nSCORE: 60\nREASONING: Mostly correct but adds minor unsupported detail.";
      const result = parseFaithfulnessResponse(raw);
      expect(result.rating).toBe("partial");
      expect(result.score).toBe(60);
    });

    it("defaults to partial/50 when parsing a malformed response", () => {
      const result = parseFaithfulnessResponse("Some garbage output with no structure.");
      expect(result.rating).toBe("partial");
      expect(result.score).toBe(50);
      expect(result.reasoning).toBe("No reasoning provided");
    });

    it("is case-insensitive for the RATING value", () => {
      const raw = "RATING: FAITHFUL\nSCORE: 88\nREASONING: Everything checks out.";
      const result = parseFaithfulnessResponse(raw);
      expect(result.rating).toBe("faithful");
    });
  });
});
