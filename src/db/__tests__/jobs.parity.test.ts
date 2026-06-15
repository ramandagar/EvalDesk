import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { jobsRepo } from "../repos/jobs";

const available: Record<string, boolean> = {
  sqlite: true,
  postgres: !!process.env.TEST_DATABASE_URL,
};

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`jobs queue — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    async function make() {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "O", slug: "o", now: 1 });
      return { jobs: jobsRepo(tdb!.db, tdb!.schema), orgId: org.id };
    }

    it("enqueue → claim → complete lifecycle", async () => {
      const { jobs, orgId } = await make();
      const j = await jobs.enqueue({ orgId, type: "run.execute", payload: { runId: "r1" }, now: 100 });
      expect(j.status).toBe("queued");
      expect(j.attempts).toBe(0);

      const claimed = await jobs.claim("w1", 100);
      expect(claimed?.id).toBe(j.id);
      expect(claimed?.status).toBe("running");
      expect(claimed?.attempts).toBe(1);
      expect(claimed?.lockedBy).toBe("w1");
      expect(claimed?.payload).toEqual({ runId: "r1" });

      // no more due jobs
      expect(await jobs.claim("w1", 100)).toBeNull();

      await jobs.complete(j.id, 200);
      expect((await jobs.getById(j.id))?.status).toBe("completed");
    });

    it("does not claim jobs scheduled in the future", async () => {
      const { jobs, orgId } = await make();
      await jobs.enqueue({ orgId, type: "x", now: 100, runAfter: 500 });
      expect(await jobs.claim("w1", 100)).toBeNull(); // not due yet
      expect((await jobs.claim("w1", 500))?.status).toBe("running"); // now due
    });

    it("two workers never claim the same job (CAS)", async () => {
      const { jobs, orgId } = await make();
      await jobs.enqueue({ orgId, type: "x", now: 1 });
      const [a, b] = await Promise.all([jobs.claim("w1", 1), jobs.claim("w2", 1)]);
      const claimedCount = [a, b].filter(Boolean).length;
      expect(claimedCount).toBe(1); // exactly one wins
    });

    it("retries with backoff, then dead-letters at max attempts", async () => {
      const { jobs, orgId } = await make();
      const j = await jobs.enqueue({ orgId, type: "x", now: 1, maxAttempts: 2 });

      await jobs.claim("w1", 1); // attempts → 1
      let after = await jobs.fail(j.id, "boom", 10, 100);
      expect(after?.status).toBe("queued"); // retry
      expect(after?.runAfter).toBe(110); // backoff
      expect(after?.lastError).toBe("boom");

      await jobs.claim("w1", 200); // attempts → 2 (== maxAttempts)
      after = await jobs.fail(j.id, "boom again", 300);
      expect(after?.status).toBe("failed"); // dead-lettered
    });
  });
}
