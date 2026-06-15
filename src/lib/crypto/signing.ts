// ============================================================================
// Ed25519 signing primitive — the cryptographic core of the signed, offline-
// verifiable evaluation certificate (moat feature #4). Pure of app IO; uses
// only node:crypto. Ed25519 signatures are deterministic, so the same key over
// the same canonical bytes yields the same signature on every engine and Node
// version — a hard requirement for the reproducible golden-certificate test.
//
// Keys are PEM (SPKI public / PKCS8 private) so they round-trip through the DB
// and a third-party verifier with no custom encoding. The signed artifact
// bundles the public key, enabling zero-egress offline verification.
// ============================================================================

import { generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, createHash } from "node:crypto";

export interface SigningKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

export function generateSigningKeyPair(): SigningKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey as string, privateKeyPem: privateKey as string };
}

/** Sign raw bytes with an Ed25519 private key (PEM). Returns base64 signature. */
export function signBytes(privateKeyPem: string, bytes: Buffer): string {
  // Ed25519 takes a null algorithm (it hashes internally).
  return cryptoSign(null, bytes, privateKeyPem).toString("base64");
}

/** Verify a base64 Ed25519 signature over raw bytes. Never throws — bad input → false. */
export function verifyBytes(publicKeyPem: string, bytes: Buffer, signatureBase64: string): boolean {
  try {
    return cryptoVerify(null, bytes, publicKeyPem, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
