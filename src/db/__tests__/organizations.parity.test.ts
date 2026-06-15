import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";

// Parity harness: identical assertions run against every AVAILABLE driver.
// SQLite always runs. Postgres is honestly SKIPPED (not a fake pass) unless
// TEST_DATABASE_URL is set — where it runs the same assertions in CI.
const available: Record<string, boolean> = {
  sqlite: true,
  postgres: !!process.env.TEST_DATABASE_URL,
};

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`organizations repo — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("create + read back round-trips identically", async () => {
      tdb = await factory();
      const repo = organizationsRepo(tdb!.db, tdb!.schema);

      const created = await repo.create({
        name: "Acme Health",
        slug: "acme",
        now: 1_700_000_000_000,
      });
      expect(created.id).toHaveLength(21);
      expect(created.name).toBe("Acme Health");
      expect(created.slug).toBe("acme");
      expect(created.createdAt).toBe(1_700_000_000_000); // epoch-ms identical across drivers
      expect(created.planId).toBeNull();
      expect(created.archivedAt).toBeNull();

      const byId = await repo.getById(created.id);
      const bySlug = await repo.getBySlug("acme");
      expect(byId).toEqual(created);
      expect(bySlug).toEqual(created);
    });

    it("getById returns null for an unknown id", async () => {
      tdb = await factory();
      const repo = organizationsRepo(tdb!.db, tdb!.schema);
      expect(await repo.getById("does-not-exist")).toBeNull();
    });

    it("slug uniqueness is enforced", async () => {
      tdb = await factory();
      const repo = organizationsRepo(tdb!.db, tdb!.schema);
      await repo.create({ name: "A", slug: "dup", now: 1 });
      await expect(repo.create({ name: "B", slug: "dup", now: 2 })).rejects.toThrow();
    });

    it("list orders by createdAt", async () => {
      tdb = await factory();
      const repo = organizationsRepo(tdb!.db, tdb!.schema);
      await repo.create({ name: "Second", slug: "b", now: 200 });
      await repo.create({ name: "First", slug: "a", now: 100 });
      const all = await repo.list();
      expect(all.map((o) => o.name)).toEqual(["First", "Second"]);
    });
  });
}
