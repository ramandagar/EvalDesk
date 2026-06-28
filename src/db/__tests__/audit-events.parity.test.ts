import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { auditEventsRepo } from "../repos/audit-events";
import { verifyChain, GENESIS_HASH } from "@/lib/audit/hash-chain";

const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`audit hash chain — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("append builds a valid, linked chain (verifyChain passes)", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const audit = auditEventsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });

      const e1 = await audit.append(org.id, { actorId: "u1", action: "api_key.created", resourceType: "api_key", resourceId: "k1", details: { name: "ci" } }, 100);
      const e2 = await audit.append(org.id, { actorId: "u1", action: "api_key.revoked", resourceType: "api_key", resourceId: "k1", details: null }, 200);

      expect(e1.seq).toBe(1);
      expect(e1.prevHash).toBe(GENESIS_HASH);
      expect(e2.seq).toBe(2);
      expect(e2.prevHash).toBe(e1.hash); // linked

      const chain = await audit.getChainForOrg(org.id);
      expect(chain).toHaveLength(2);
      expect(verifyChain(chain)).toEqual({ valid: true });
    });

    it("two orgs have independent chains (both start at seq 1)", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const audit = auditEventsRepo(tdb!.db, tdb!.schema);
      const orgA = await orgs.create({ name: "A", slug: "a", now: 1 });
      const orgB = await orgs.create({ name: "B", slug: "b", now: 1 });

      const a1 = await audit.append(orgA.id, { actorId: null, action: "run.finalized", resourceType: "run", resourceId: "r1", details: null }, 1);
      const b1 = await audit.append(orgB.id, { actorId: null, action: "run.finalized", resourceType: "run", resourceId: "r2", details: null }, 1);

      expect(a1.seq).toBe(1);
      expect(b1.seq).toBe(1); // independent chains
      expect(a1.hash).not.toBe(b1.hash);
      expect((await audit.getChainForOrg(orgA.id))).toHaveLength(1);
      expect((await audit.getChainForOrg(orgB.id))).toHaveLength(1);
    });

    it("listForOrg returns newest-first and respects limit", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const audit = auditEventsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      for (let i = 0; i < 5; i++) {
        await audit.append(org.id, { actorId: null, action: `event.${i}`, resourceType: null, resourceId: null, details: null }, i);
      }
      const all = await audit.listForOrg(org.id, { limit: 100 });
      expect(all.map((e) => e.seq)).toEqual([5, 4, 3, 2, 1]); // newest-first
      const top2 = await audit.listForOrg(org.id, { limit: 2 });
      expect(top2.map((e) => e.seq)).toEqual([5, 4]);
      const before3 = await audit.listForOrg(org.id, { limit: 100, beforeSeq: 3 });
      expect(before3.map((e) => e.seq)).toEqual([2, 1]);
    });

    it("is tamper-evident: mutating a stored action breaks verifyChain", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const audit = auditEventsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      const e1 = await audit.append(org.id, { actorId: "u1", action: "member.added", resourceType: "membership", resourceId: "m1", details: null }, 1);
      await audit.append(org.id, { actorId: "u1", action: "member.removed", resourceType: "membership", resourceId: "m1", details: null }, 2);

      expect(verifyChain(await audit.getChainForOrg(org.id))).toEqual({ valid: true });

      // Tamper with the first event's action directly in the DB (bypassing the repo).
      await tdb!.db.update(tdb!.schema.auditEvents).set({ action: "member.made_admin" }).where(eq(tdb!.schema.auditEvents.id, e1.id));

      const result = verifyChain(await audit.getChainForOrg(org.id));
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
    });

    it("the (org_id, seq) unique constraint prevents a duplicate sequence", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const audit = auditEventsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      await audit.append(org.id, { actorId: null, action: "a", resourceType: null, resourceId: null, details: null }, 1);
      // a second append at the SAME seq (1) must violate the unique constraint
      await expect(
        tdb!.db.insert(tdb!.schema.auditEvents).values({
          orgId: org.id,
          seq: 1,
          actorId: null,
          action: "dup",
          resourceType: null,
          resourceId: null,
          details: null,
          prevHash: GENESIS_HASH,
          hash: "deadbeef",
          createdAt: 2,
        }),
      ).rejects.toThrow();
    });
  });
}
