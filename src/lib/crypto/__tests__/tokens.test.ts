import { describe, it, expect } from "vitest";
import { generateToken, hashToken, issueToken } from "@/lib/crypto/tokens";

describe("crypto/tokens", () => {
  it("generates url-safe, high-entropy, unique tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding chars
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
  });

  it("hashToken is deterministic and one-way (64-hex sha256)", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("issueToken returns a raw token whose hash matches", () => {
    const { token, tokenHash } = issueToken();
    expect(tokenHash).toBe(hashToken(token));
    // the stored hash never equals the raw secret
    expect(tokenHash).not.toBe(token);
  });
});
