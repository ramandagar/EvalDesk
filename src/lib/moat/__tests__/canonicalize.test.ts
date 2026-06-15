import { describe, it, expect } from "vitest";
import { canonicalize, canonicalBytes } from "../canonicalize";

describe("canonicalize — structure", () => {
  it("sorts object keys, no whitespace", () => {
    expect(canonicalize({ b: 2, a: 1, c: 3 })).toBe('{"a":1,"b":2,"c":3}');
  });
  it("sorts nested object keys recursively", () => {
    expect(canonicalize({ z: { y: 1, x: 2 }, a: [3, 2, 1] })).toBe('{"a":[3,2,1],"z":{"x":2,"y":1}}');
  });
  it("preserves array order (arrays are ordered, not sorted)", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });
  it("drops undefined members; keeps null", () => {
    expect(canonicalize({ a: undefined, b: null, c: 1 })).toBe('{"b":null,"c":1}');
  });
});

describe("canonicalize — RFC 8785 §3.2.3 key ordering vector", () => {
  // Keys must sort by UTF-16 code unit, NOT by code point — so the astral
  // emoji (lead surrogate D83D) sorts before U+FB33.
  it("orders mixed-script keys by UTF-16 code units", () => {
    const input: Record<string, string> = {
      "€": "Euro Sign",
      "\r": "Carriage Return",
      "דּ": "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "😀": "Emoji: Grinning Face",
      "": "Control",
      "ö": "Latin Small Letter O With Diaeresis",
    };
    const out = canonicalize(input);
    const order = [...out.matchAll(/"((?:[^"\\]|\\.)*)":/g)].map((m) => m[1]);
    // \r,1,,ö,€,<emoji>,דּ
    expect(order).toEqual(["\\r", "1", "", "ö", "€", "😀", "דּ"]);
  });
});

describe("canonicalize — strings", () => {
  it("uses short escapes for control whitespace", () => {
    expect(canonicalize("a\nb\tc\rd")).toBe('"a\\nb\\tc\\rd"');
  });
  it("escapes quote and backslash", () => {
    expect(canonicalize('he said "hi"\\')).toBe('"he said \\"hi\\"\\\\"');
  });
  it("escapes other control chars as \\u00XX", () => {
    expect(canonicalize("")).toBe('"\\u0001\\u001f"');
  });
  it("emits non-ASCII as raw UTF-8 (no \\u escaping)", () => {
    expect(canonicalize("café €")).toBe('"café €"');
  });
});

describe("canonicalize — numbers", () => {
  it("integers (epoch-ms) verbatim", () => {
    expect(canonicalize(1780358961767)).toBe("1780358961767");
  });
  it("normalizes -0 to 0", () => {
    expect(canonicalize(-0)).toBe("0");
  });
  it("rounded reals (toFixed-style) round-trip", () => {
    expect(canonicalize(0.123456)).toBe("0.123456");
    expect(canonicalize(1.5)).toBe("1.5");
  });
  it("rejects NaN / Infinity (must never reach a signed payload)", () => {
    expect(() => canonicalize(NaN)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
  });
});

describe("canonicalize — determinism", () => {
  it("is identical regardless of input key insertion order", () => {
    const a = canonicalize({ kappa: 0.42, n: 12, method: "cohen" });
    const b = canonicalize({ method: "cohen", n: 12, kappa: 0.42 });
    expect(a).toBe(b);
  });
  it("canonicalBytes is UTF-8 of the canonical string", () => {
    const v = { x: "€" };
    expect(canonicalBytes(v).toString("utf8")).toBe(canonicalize(v));
    expect(canonicalBytes(v)).toEqual(Buffer.from('{"x":"€"}', "utf8"));
  });
});
