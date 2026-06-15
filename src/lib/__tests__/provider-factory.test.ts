import { describe, it, expect } from "vitest";
import {
  resolveProvider,
  defaultModelFor,
  baseUrlFor,
  isProviderName,
} from "@/lib/provider-factory";

describe("provider factory", () => {
  it("knows DeepSeek's endpoint and default model", () => {
    expect(baseUrlFor("deepseek")).toBe("https://api.deepseek.com/v1");
    expect(defaultModelFor("deepseek")).toBe("deepseek-chat");
  });

  it("builds a deepseek provider from env", () => {
    const p = resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "sk-x" } });
    expect(p.name).toBe("openai"); // OpenAI-compatible impl under the hood
  });

  it("accepts an explicit apiKey override (per-project key)", () => {
    expect(() => resolveProvider({ name: "deepseek", apiKey: "sk-override", env: {} })).not.toThrow();
  });

  it("throws a clear error when the key env is missing", () => {
    expect(() => resolveProvider({ name: "deepseek", env: {} })).toThrow(/DEEPSEEK_API_KEY/);
    expect(() => resolveProvider({ name: "openai", env: {} })).toThrow(/OPENAI_API_KEY/);
  });

  it("ollama needs no key", () => {
    expect(() => resolveProvider({ name: "ollama", env: {} })).not.toThrow();
    expect(baseUrlFor("ollama")).toContain("11434");
  });

  it("validates provider names", () => {
    expect(isProviderName("deepseek")).toBe(true);
    expect(isProviderName("openrouter")).toBe(true);
    expect(isProviderName("bard")).toBe(false);
  });
});
