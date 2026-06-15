// ============================================================================
// Immutable audit hash chain. Each audit event stores a hash of
// (previous hash + canonicalized event). Altering, inserting, deleting, or
// reordering any past event breaks the chain, so the log is tamper-evident.
// Chains are per-organization (the worker seals each org's chain).
//
// Pure module: deterministic canonicalization + sha256, fully unit-tested. The
// DB table and the sealing worker (which assign seq + persist) are wiring.
// ============================================================================

import { createHash } from "node:crypto";

export interface AuditEventInput {
  seq: number;
  orgId: string;
  actorId: string | null;
  action: string; // e.g. "project.deleted", "rating.submitted"
  resourceType: string | null;
  resourceId: string | null;
  details: unknown; // JSON-serializable
  createdAt: number; // epoch-ms
}

export interface AuditEvent extends AuditEventInput {
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = "0".repeat(64);

/** Deterministic stringify: object keys sorted, undefined dropped. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function computeHash(prevHash: string, input: AuditEventInput): string {
  const canonical = stableStringify({
    seq: input.seq,
    orgId: input.orgId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    details: input.details,
    createdAt: input.createdAt,
  });
  return createHash("sha256").update(`${prevHash}\n${canonical}`).digest("hex");
}

/** Link a new event onto the chain head. */
export function appendEvent(prevHash: string, input: AuditEventInput): AuditEvent {
  return { ...input, prevHash, hash: computeHash(prevHash, input) };
}

/** Build a full chain from ordered inputs (used by the sealer). */
export function buildChain(inputs: AuditEventInput[]): AuditEvent[] {
  const out: AuditEvent[] = [];
  let prev = GENESIS_HASH;
  for (const input of inputs) {
    const event = appendEvent(prev, input);
    out.push(event);
    prev = event.hash;
  }
  return out;
}

export interface ChainVerification {
  valid: boolean;
  brokenAt?: number; // seq of the first bad event
  reason?: string;
}

/** Verify an ordered chain: links intact and no event tampered. */
export function verifyChain(events: AuditEvent[]): ChainVerification {
  let prev = GENESIS_HASH;
  for (const event of events) {
    if (event.prevHash !== prev) {
      return { valid: false, brokenAt: event.seq, reason: "broken link (prevHash mismatch)" };
    }
    if (computeHash(prev, event) !== event.hash) {
      return { valid: false, brokenAt: event.seq, reason: "tampered event (hash mismatch)" };
    }
    prev = event.hash;
  }
  return { valid: true };
}
