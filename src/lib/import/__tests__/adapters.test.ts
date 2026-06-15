import { describe, it, expect } from "vitest";
import { detectAndParse, ADAPTERS, ImportError } from "../adapters";

describe("import adapters — DeepEval", () => {
  it("parses a goldens dataset", () => {
    const raw = JSON.stringify({
      goldens: [
        { input: "What is 2+2?", expected_output: "4", category: "math" },
        { name: "greeting", input: "hi", expected_output: "hello" },
      ],
    });
    const { adapter, cases } = detectAndParse(raw);
    expect(adapter.id).toBe("deepeval");
    expect(cases).toHaveLength(2);
    expect(cases[0]).toEqual({ title: "Case 1", input: "What is 2+2?", expectedOutput: "4", category: "math" });
    expect(cases[1].title).toBe("greeting");
  });

  it("parses a bare array of test cases", () => {
    const raw = JSON.stringify([{ input: "q", expected_output: "a" }]);
    const { adapter, cases } = detectAndParse(raw);
    expect(adapter.id).toBe("deepeval");
    expect(cases[0].input).toBe("q");
  });
});

describe("import adapters — Langfuse", () => {
  it("parses items with expectedOutput (camelCase)", () => {
    const raw = JSON.stringify({
      items: [{ id: "it1", input: "ping", expectedOutput: "pong", metadata: { category: "smoke" } }],
    });
    const { adapter, cases } = detectAndParse(raw);
    expect(adapter.id).toBe("langfuse");
    expect(cases[0]).toEqual({ title: "it1", input: "ping", expectedOutput: "pong", category: "smoke" });
  });
});

describe("import adapters — OpenAI Evals", () => {
  it("parses chat-format JSONL samples", () => {
    const raw = [
      JSON.stringify({ input: [{ role: "system", content: "be terse" }, { role: "user", content: "2+2?" }], ideal: "4" }),
      JSON.stringify({ input: [{ role: "user", content: "color of sky?" }], ideal: ["blue", "azure"] }),
    ].join("\n");
    const { adapter, cases } = detectAndParse(raw);
    expect(adapter.id).toBe("openai_evals");
    expect(cases).toHaveLength(2);
    expect(cases[0].input).toBe("system: be terse\nuser: 2+2?");
    expect(cases[0].expectedOutput).toBe("4");
    expect(cases[1].expectedOutput).toBe("blue | azure"); // ideal array joined
  });

  it("raises unsupported_sample_shape with a line number rather than mis-mapping", () => {
    // looks like openai-evals on line 1 but line 2 is a bad shape
    const raw = [
      JSON.stringify({ input: [{ role: "user", content: "ok" }], ideal: "x" }),
      JSON.stringify({ input: "not-an-array", ideal: "y" }),
    ].join("\n");
    try {
      detectAndParse(raw);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).code).toBe("unsupported_sample_shape");
      expect((e as ImportError).line).toBe(2);
    }
  });
});

describe("import adapters — detection precedence + failure", () => {
  it("openai-evals does not steal deepeval/langfuse JSON (it needs chat input + ideal)", () => {
    const raw = JSON.stringify({ goldens: [{ input: "q", expected_output: "a" }] });
    expect(ADAPTERS.find((a) => a.detect(raw))?.id).toBe("deepeval");
  });

  it("throws unknown_format for unrecognized input", () => {
    expect(() => detectAndParse(JSON.stringify({ random: "thing" }))).toThrowError(/detect a supported eval format/);
    try {
      detectAndParse("not json at all");
    } catch (e) {
      expect((e as ImportError).code).toBe("unknown_format");
    }
  });

  it("invalid JSONL reports the bad line number", () => {
    const raw = JSON.stringify({ input: [{ role: "user", content: "x" }], ideal: "y" }) + "\n{ broken";
    try {
      detectAndParse(raw);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as ImportError).code).toBe("invalid_jsonl");
      expect((e as ImportError).line).toBe(2);
    }
  });
});
