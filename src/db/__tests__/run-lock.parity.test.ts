import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { projectsRepo } from "../repos/projects";
import { runsRepo } from "../repos/runs";

const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`signed-run immutability — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("a SIGNED (locked) run cannot be downgraded or mutated by a later update", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const runs = runsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      const project = await projects.create(org.id, { name: "P", now: 1 });
      const run = await runs.create(org.id, { projectId: project.id, status: "completed", now: 1 });

      // finalize locks the run
      await runs.update(org.id, run.id, { status: "signed", completedAt: 100 });
      expect((await runs.getInOrg(org.id, run.id))!.status).toBe("signed");

      // a late/retried run.judge tries to downgrade it → rejected (no-op)
      const downgrade = await runs.update(org.id, run.id, { status: "completed", passCount: 99 });
      expect(downgrade).toBeNull(); // nothing matched the (status != signed) guard
      const after = await runs.getInOrg(org.id, run.id);
      expect(after!.status).toBe("signed"); // still signed
      expect(after!.passCount).toBe(0); // counters untouched too

      // re-asserting "signed" is idempotently allowed (finalize retry)
      const resign = await runs.update(org.id, run.id, { status: "signed" });
      expect(resign?.status).toBe("signed");
    });

    it("a non-signed run still updates normally", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const runs = runsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      const project = await projects.create(org.id, { name: "P", now: 1 });
      const run = await runs.create(org.id, { projectId: project.id, status: "queued", now: 1 });

      const updated = await runs.update(org.id, run.id, { status: "completed", passCount: 3 });
      expect(updated?.status).toBe("completed");
      expect(updated?.passCount).toBe(3);
    });
  });
}
