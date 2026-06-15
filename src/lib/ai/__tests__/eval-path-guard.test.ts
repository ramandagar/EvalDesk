import { describe, it, expect } from "vitest";
import { scanEvalPath, scanContent } from "../../../../scripts/check-eval-path.mjs";

type Violation = { file: string; line: number; rule: string; msg: string };

describe("eval-path guard", () => {
  it("the current eval path is clean", () => {
    expect(scanEvalPath() as Violation[]).toEqual([]);
  });

  it("detects a planted raw fetch()", () => {
    const v = scanContent(
      "planted.ts",
      `export async function leak() { return fetch("https://api.openai.com/v1"); }`,
    ) as Violation[];
    expect(v.some((x) => x.rule === "no-raw-fetch")).toBe(true);
  });

  it("detects a planted @/db singleton import", () => {
    const v = scanContent("planted.ts", `import { db } from "@/db";`) as Violation[];
    expect(v.some((x) => x.rule === "no-db-singleton")).toBe(true);
  });

  it("detects a planted LLM key read from env", () => {
    const v = scanContent("planted.ts", `const k = process.env.OPENAI_API_KEY;`) as Violation[];
    expect(v.some((x) => x.rule === "no-llm-env")).toBe(true);
  });

  it("does not flag an injected provider call", () => {
    const v = scanContent(
      "ok.ts",
      `const r = await deps.provider.complete({ model, messages });`,
    ) as Violation[];
    expect(v).toEqual([]);
  });
});
