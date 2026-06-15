import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, needsRewrap, type Keyring } from "@/lib/crypto/secrets";
import { loadKeyringFromEnv } from "@/lib/crypto/keyring";

const k1 = Buffer.alloc(32, 1);
const k2 = Buffer.alloc(32, 2);
const ring1: Keyring = { activeKeyId: "k1", keys: { k1 } };
const ring2: Keyring = { activeKeyId: "k2", keys: { k2 } };
const rotated: Keyring = { activeKeyId: "k2", keys: { k1, k2 } };

const AAD = "org:abc:agentApiKey";

describe("secret encryption (AES-256-GCM)", () => {
  it("round-trips plaintext", () => {
    const blob = encryptSecret("sk-secret-value", ring1, AAD);
    expect(decryptSecret(blob, ring1, AAD)).toBe("sk-secret-value");
  });

  it("produces a fresh ciphertext each time (random IV)", () => {
    const a = encryptSecret("same", ring1, AAD);
    const b = encryptSecret("same", ring1, AAD);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, ring1, AAD)).toBe("same");
    expect(decryptSecret(b, ring1, AAD)).toBe("same");
  });

  it("fails closed with the wrong key", () => {
    const blob = encryptSecret("x", ring1, AAD);
    expect(() => decryptSecret(blob, ring2, AAD)).toThrow();
  });

  it("fails closed when the AAD context differs (no cross-row reuse)", () => {
    const blob = encryptSecret("x", ring1, AAD);
    expect(() => decryptSecret(blob, ring1, "org:OTHER:agentApiKey")).toThrow();
  });

  it("fails closed on tampered ciphertext", () => {
    const blob = encryptSecret("x", ring1, AAD);
    const parts = blob.split(":");
    // flip a character in the ciphertext segment
    parts[4] = parts[4][0] === "A" ? "B" + parts[4].slice(1) : "A" + parts[4].slice(1);
    expect(() => decryptSecret(parts.join(":"), ring1, AAD)).toThrow();
  });

  it("throws on malformed blobs", () => {
    expect(() => decryptSecret("not-a-blob", ring1, AAD)).toThrow(/malformed/);
    expect(() => decryptSecret("v1:k1:only:three", ring1, AAD)).toThrow(/malformed/);
  });

  it("supports key rotation: old blobs decrypt, needsRewrap flags them", () => {
    const old = encryptSecret("legacy", ring1, AAD); // sealed with k1
    expect(decryptSecret(old, rotated, AAD)).toBe("legacy"); // ring still holds k1
    expect(needsRewrap(old, rotated)).toBe(true); // active is now k2
    const fresh = encryptSecret("legacy", rotated, AAD); // sealed with active k2
    expect(needsRewrap(fresh, rotated)).toBe(false);
  });
});

describe("loadKeyringFromEnv", () => {
  it("parses keys and validates the active id", () => {
    const env = {
      EVALDESK_ENCRYPTION_KEYS: `k1:${k1.toString("base64")},k2:${k2.toString("base64")}`,
      EVALDESK_ACTIVE_KEY_ID: "k2",
    };
    const ring = loadKeyringFromEnv(env);
    expect(ring.activeKeyId).toBe("k2");
    expect(Object.keys(ring.keys).sort()).toEqual(["k1", "k2"]);
    // usable end-to-end
    expect(decryptSecret(encryptSecret("hi", ring, AAD), ring, AAD)).toBe("hi");
  });

  it("fails closed when unconfigured or active id missing", () => {
    expect(() => loadKeyringFromEnv({})).toThrow(/Encryption not configured/);
    expect(() =>
      loadKeyringFromEnv({
        EVALDESK_ENCRYPTION_KEYS: `k1:${k1.toString("base64")}`,
        EVALDESK_ACTIVE_KEY_ID: "nope",
      }),
    ).toThrow(/not present/);
  });

  it("rejects keys that aren't 32 bytes", () => {
    expect(() =>
      loadKeyringFromEnv({
        EVALDESK_ENCRYPTION_KEYS: `k1:${Buffer.alloc(16, 9).toString("base64")}`,
        EVALDESK_ACTIVE_KEY_ID: "k1",
      }),
    ).toThrow(/32 bytes/);
  });
});
