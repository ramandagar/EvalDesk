import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { usersRepo } from "../repos/users";
import { membershipsRepo } from "../repos/memberships";
import { sessionsRepo } from "../repos/sessions";

const available: Record<string, boolean> = {
  sqlite: true,
  postgres: !!process.env.TEST_DATABASE_URL,
};

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`identity repos — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("users: create, lookup by id + email, unique email", async () => {
      tdb = await factory();
      const repo = usersRepo(tdb!.db, tdb!.schema);
      const u = await repo.create({ name: "Dr Acme", email: "dr@acme.test", now: 1000 });
      expect(u.id).toHaveLength(21);
      expect(u.passwordHash).toBeNull();
      expect(await repo.getById(u.id)).toEqual(u);
      expect(await repo.getByEmail("dr@acme.test")).toEqual(u);
      expect(await repo.getByEmail("missing@acme.test")).toBeNull();
      await expect(repo.create({ name: "X", email: "dr@acme.test", now: 2000 })).rejects.toThrow();
    });

    it("memberships: org+user lookup, uniqueness, list scoping", async () => {
      tdb = await factory();
      const users = usersRepo(tdb!.db, tdb!.schema);
      const orgs = (await import("../repos/organizations")).organizationsRepo(tdb!.db, tdb!.schema);
      const mems = membershipsRepo(tdb!.db, tdb!.schema);

      const org = await orgs.create({ name: "Acme", slug: "acme", now: 1 });
      const u = await users.create({ name: "U", email: "u@a.test", now: 1 });

      const m = await mems.create({ orgId: org.id, userId: u.id, role: "owner", now: 1 });
      expect(m.role).toBe("owner");
      expect(await mems.get(org.id, u.id)).toEqual(m);
      expect(await mems.get(org.id, "someone-else")).toBeNull();
      expect((await mems.listForUser(u.id)).map((x) => x.id)).toEqual([m.id]);
      // duplicate (org,user) membership rejected
      await expect(
        mems.create({ orgId: org.id, userId: u.id, role: "viewer", now: 2 }),
      ).rejects.toThrow();
    });

    it("sessions: create, fetch by hash, set active org, revoke", async () => {
      tdb = await factory();
      const users = usersRepo(tdb!.db, tdb!.schema);
      const sessions = sessionsRepo(tdb!.db, tdb!.schema);
      const u = await users.create({ name: "U", email: "s@a.test", now: 1 });

      const s = await sessions.create({
        userId: u.id,
        tokenHash: "hash-abc",
        expiresAt: 9_999,
        now: 1,
      });
      expect(s.revokedAt).toBeNull();
      expect(await sessions.getByTokenHash("hash-abc")).toEqual(s);
      expect(await sessions.getByTokenHash("nope")).toBeNull();

      await sessions.setActiveOrg(s.id, "org-1");
      await sessions.revoke(s.id, 5_000);
      const after = await sessions.getByTokenHash("hash-abc");
      expect(after?.orgId).toBe("org-1");
      expect(after?.revokedAt).toBe(5_000);
    });
  });
}
