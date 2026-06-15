import { describe, it, expect } from "vitest";
import { generateSigningKeyPair, signBytes, verifyBytes, sha256Hex } from "../signing";

describe("Ed25519 signing", () => {
  it("a valid signature verifies", () => {
    const kp = generateSigningKeyPair();
    const msg = Buffer.from("the canonical certificate bytes", "utf8");
    const sig = signBytes(kp.privateKeyPem, msg);
    expect(verifyBytes(kp.publicKeyPem, msg, sig)).toBe(true);
  });

  it("a flipped byte fails verification", () => {
    const kp = generateSigningKeyPair();
    const msg = Buffer.from('{"kappa":0.42}', "utf8");
    const sig = signBytes(kp.privateKeyPem, msg);
    const tampered = Buffer.from('{"kappa":0.43}', "utf8");
    expect(verifyBytes(kp.publicKeyPem, tampered, sig)).toBe(false);
  });

  it("a signature from a different key fails", () => {
    const a = generateSigningKeyPair();
    const b = generateSigningKeyPair();
    const msg = Buffer.from("hello", "utf8");
    const sig = signBytes(a.privateKeyPem, msg);
    expect(verifyBytes(b.publicKeyPem, msg, sig)).toBe(false);
  });

  it("is deterministic — same key + bytes → identical signature", () => {
    const kp = generateSigningKeyPair();
    const msg = Buffer.from("deterministic", "utf8");
    expect(signBytes(kp.privateKeyPem, msg)).toBe(signBytes(kp.privateKeyPem, msg));
  });

  it("malformed signature/key returns false, never throws", () => {
    const kp = generateSigningKeyPair();
    const msg = Buffer.from("x", "utf8");
    expect(verifyBytes(kp.publicKeyPem, msg, "not-base64-sig!!")).toBe(false);
    expect(verifyBytes("not a key", msg, "AAAA")).toBe(false);
  });

  it("sha256Hex is stable", () => {
    expect(sha256Hex(Buffer.from("abc", "utf8"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
