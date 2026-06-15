import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { projectsRepo } from "../repos/projects";

const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`keyset pagination — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("orders by (created_at,id) and pages without gaps/dupes — even on created_at ties", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });

      // 7 projects; some share a created_at to exercise the id tiebreaker
      const created = [];
      for (let i = 0; i < 7; i++) created.push(await projects.create(org.id, { name: `P${i}`, now: i < 4 ? 100 : 100 + i }));

      // walk in pages of 3
      const seen: string[] = [];
      let after: { createdAt: number; id: string } | undefined;
      for (let guard = 0; guard < 10; guard++) {
        const rows = await projects.listPage(org.id, { limit: 4, after }); // limit+1=4 to peek
        const pageRows = rows.slice(0, 3);
        if (pageRows.length === 0) break;
        seen.push(...pageRows.map((r) => r.id));
        if (rows.length <= 3) break;
        const last = pageRows[pageRows.length - 1];
        after = { createdAt: last.createdAt, id: last.id };
      }

      // every project seen exactly once
      expect(seen.sort()).toEqual(created.map((p) => p.id).sort());
      expect(new Set(seen).size).toBe(7);

      // global order is non-decreasing by (created_at,id)
      const all = await projects.listPage(org.id, { limit: 100 });
      for (let i = 1; i < all.length; i++) {
        const a = all[i - 1];
        const b = all[i];
        expect(a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id)).toBe(true);
      }
    });

    it("is org-scoped — another org's rows never appear", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const a = await orgs.create({ name: "A", slug: "a", now: 1 });
      const b = await orgs.create({ name: "B", slug: "b", now: 1 });
      await projects.create(a.id, { name: "a1", now: 1 });
      await projects.create(b.id, { name: "b1", now: 1 });
      const page = await projects.listPage(a.id, { limit: 10 });
      expect(page.map((p) => p.name)).toEqual(["a1"]);
    });
  });
}
