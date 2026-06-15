// ============================================================================
// Opaque session/API tokens. We never store the raw token — only its SHA-256
// hash. The raw token is shown once to the client (cookie / API key) and is
// unrecoverable from the database, so a DB leak does not expose live tokens.
// ============================================================================

import { randomBytes, createHash } from "node:crypto";

/** A URL-safe random secret. 32 bytes = 256 bits of entropy. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Deterministic lookup hash for a token (what we persist). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedToken {
  /** Shown to the client once; never stored. */
  token: string;
  /** Stored for lookup. */
  tokenHash: string;
}

export function issueToken(bytes = 32): IssuedToken {
  const token = generateToken(bytes);
  return { token, tokenHash: hashToken(token) };
}
