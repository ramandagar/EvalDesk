import { describe, it, expect } from "vitest";
import {
  buildChain,
  verifyChain,
  computeHash,
  stableStringify,
  GENESIS_HASH,
  type AuditEventInput,
  type AuditEvent,
} from "@/lib/audit/hash-chain";

function inputs(): AuditEventInput[] {
  return [
    { seq: 1, orgId: "o1", actorId: "u1", action: "project.created", resourceType: "project", resourceId: "p1", details: { name: "A" }, createdAt: 1000 },
    { seq: 2, orgId: "o1", actorId: "u1", action: "run.completed", resourceType: "run", resourceId: "r1", details: { passRate: 80 }, createdAt: 2000 },
    { seq: 3, orgId: "o1", actorId: "u2", action: "project.deleted", resourceType: "project", resourceId: "p1", details: null, createdAt: 3000 },
  ];
}

describe("audit hash chain", () => {
  it("links each event to the previous (first prevHash = genesis)", () => {
    const chain = buildChain(inputs());
    expect(chain[0].prevHash).toBe(GENESIS_HASH);
    expect(chain[1].prevHash).toBe(chain[0].hash);
    expect(chain[2].prevHash).toBe(chain[1].hash);
    expect(chain.every((e) => /^[0-9a-f]{64}$/.test(e.hash))).toBe(true);
  });

  it("verifies a well-formed chain", () => {
    expect(verifyChain(buildChain(inputs()))).toEqual({ valid: true });
  });

  it("detects a tampered event (mutated details)", () => {
    const chain = buildChain(inputs());
    const tampered: AuditEvent[] = chain.map((e) =>
      e.seq === 2 ? { ...e, details: { passRate: 100 } } : e,
    );
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toMatch(/tampered/);
  });

  it("detects a forged hash", () => {
    const chain = buildChain(inputs());
    const forged = chain.map((e) => (e.seq === 3 ? { ...e, hash: "f".repeat(64) } : e));
    expect(verifyChain(forged).valid).toBe(false);
  });

  it("detects a deleted/reordered event (broken link)", () => {
    const chain = buildChain(inputs());
    const withHole = [chain[0], chain[2]]; // drop seq 2
    const result = verifyChain(withHole);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/broken link/);
  });

  it("is deterministic regardless of details key order (canonicalization)", () => {
    const base: AuditEventInput = {
      seq: 1, orgId: "o1", actorId: "u1", action: "x", resourceType: null, resourceId: null,
      details: { a: 1, b: 2, nested: { y: 9, x: 8 } }, createdAt: 1,
    };
    const reordered: AuditEventInput = { ...base, details: { nested: { x: 8, y: 9 }, b: 2, a: 1 } };
    expect(computeHash(GENESIS_HASH, base)).toBe(computeHash(GENESIS_HASH, reordered));
  });

  it("stableStringify sorts keys and drops undefined", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(stableStringify([3, { z: 1, a: 2 }])).toBe('[3,{"a":2,"z":1}]');
  });
});
