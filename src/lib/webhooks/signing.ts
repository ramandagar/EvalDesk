// ============================================================================
// Webhook signing — PURE (node:crypto only). HMAC-SHA256 over "{timestamp}.{body}"
// in the Stripe-style `EvalDesk-Signature: t=<ts>,v1=<hex>` form, with a replay
// tolerance window. The receiver recomputes the MAC over the EXACT raw body it
// got, so any tampering or replay outside the window is rejected. Comparison is
// constant-time. The signing secret is envelope-encrypted at rest (the worker
// decrypts it just before delivery); this module never touches storage.
// ============================================================================

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "EvalDesk-Signature";
export const DEFAULT_TOLERANCE_SEC = 300; // 5 minutes

/** The signed content is the timestamp and the raw body, joined by a dot. */
export function signedPayload(timestampSec: number, body: string): string {
  return `${timestampSec}.${body}`;
}

export function computeMac(secret: string, timestampSec: number, body: string): string {
  return createHmac("sha256", secret).update(signedPayload(timestampSec, body)).digest("hex");
}

/** Build the `t=<ts>,v1=<hex>` signature header value. */
export function buildSignatureHeader(secret: string, body: string, timestampSec: number): string {
  return `t=${timestampSec},v1=${computeMac(secret, timestampSec, body)}`;
}

export interface ParsedSignature {
  t: number | null;
  v1: string[];
}

export function parseSignatureHeader(header: string): ParsedSignature {
  const out: ParsedSignature = { t: null, v1: [] };
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === "t") out.t = Number.parseInt(val, 10);
    else if (key === "v1") out.v1.push(val);
  }
  return out;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export type VerifyFailure = "malformed" | "no-timestamp" | "expired" | "bad-signature";

export interface VerifyResult {
  valid: boolean;
  reason?: VerifyFailure;
}

/**
 * Verify an incoming webhook. Recomputes the MAC over (t, rawBody) and compares
 * in constant time; rejects timestamps outside ±tolerance (replay defense).
 */
export function verifySignature(
  secret: string,
  header: string | null | undefined,
  rawBody: string,
  nowSec: number,
  toleranceSec = DEFAULT_TOLERANCE_SEC,
): VerifyResult {
  if (!header) return { valid: false, reason: "malformed" };
  const parsed = parseSignatureHeader(header);
  if (parsed.t === null || Number.isNaN(parsed.t)) return { valid: false, reason: "no-timestamp" };
  if (Math.abs(nowSec - parsed.t) > toleranceSec) return { valid: false, reason: "expired" };
  const expected = computeMac(secret, parsed.t, rawBody);
  // accept if ANY provided v1 matches (supports secret rotation)
  const ok = parsed.v1.some((sig) => constantTimeEqualHex(sig, expected));
  return ok ? { valid: true } : { valid: false, reason: "bad-signature" };
}
