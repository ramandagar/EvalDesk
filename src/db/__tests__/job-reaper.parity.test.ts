import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { jobsRepo } from "../repos/jobs";

const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`stale-job reaper — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("reclaims a job orphaned by a crashed worker, without burning a retry", async () => {
      tdb = await factory();
      const org = await organizationsRepo(tdb!.db, tdb!.schema).create({ name: "A", slug: "a", now: 1 });
      const jobs = jobsRepo(tdb!.db, tdb!.schema);

      await jobs.enqueue({ orgId: org.id, type: "run.execute", payload: { x: 1 }, now: 1000 });

      // worker claims it (status running, attempts=1, locked_at=1000) then "crashes"
      const claimed = await jobs.claim("crashed-worker", 1000);
      expect(claimed?.status).toBe("running");
      expect(claimed?.attempts).toBe(1);

      // not stale yet (only 30s passed, stale window is 60s) → nothing reaped
      expect(await jobs.reapStale(1000 + 30_000, 60_000)).toBe(0);
      expect((await jobs.getById(claimed!.id))!.status).toBe("running");

      // past the stale window → reaped back to queued, attempt decremented
      expect(await jobs.reapStale(1000 + 120_000, 60_000)).toBe(1);
      const reaped = await jobs.getById(claimed!.id);
      expect(reaped!.status).toBe("queued");
      expect(reaped!.attempts).toBe(0); // retry NOT burned
      expect(reaped!.lockedBy).toBeNull();

      // a healthy worker can now re-claim it
      const reclaimed = await jobs.claim("healthy-worker", 1000 + 130_000);
      expect(reclaimed?.id).toBe(claimed!.id);
      expect(reclaimed?.attempts).toBe(1);
    });

    it("never touches a completed job", async () => {
      tdb = await factory();
      const org = await organizationsRepo(tdb!.db, tdb!.schema).create({ name: "A", slug: "a", now: 1 });
      const jobs = jobsRepo(tdb!.db, tdb!.schema);
      await jobs.enqueue({ orgId: org.id, type: "run.execute", now: 1000 });
      const c = await jobs.claim("w", 1000);
      await jobs.complete(c!.id, 1000);
      expect(await jobs.reapStale(1000 + 999_999, 60_000)).toBe(0);
    });
  });
}
