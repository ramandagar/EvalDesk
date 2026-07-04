import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { projectsRepo } from "../repos/projects";
import { runsRepo } from "../repos/runs";
import { testCasesRepo } from "../repos/test-cases";
import { runResultsRepo } from "../repos/run-results";

const available: Record<string, boolean> = {
  sqlite: true,
  postgres: !!process.env.TEST_DATABASE_URL,
};

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`run_results token columns — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    async function setup() {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "O", slug: `o-tok-${driver}`, now: 1 });
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const project = await projects.create(org.id, { name: "P", now: 1 });
      const runs = runsRepo(tdb!.db, tdb!.schema);
      const run = await runs.create(org.id, { projectId: project.id, status: "queued", now: 1 });
      const cases = testCasesRepo(tdb!.db, tdb!.schema);
      const tc = await cases.create(org.id, { projectId: project.id, title: "T", input: "q", now: 1 });
      return { org, run, tc, results: runResultsRepo(tdb!.db, tdb!.schema) };
    }

    it("create with tokensIn + tokensOut → round-trips correctly", async () => {
      const { org, run, tc, results } = await setup();
      const rr = await results.create(org.id, {
        runId: run.id,
        testCaseId: tc.id,
        agentResponse: "42",
        tokensIn: 123,
        tokensOut: 45,
        now: 10,
      });

      expect(rr.tokensIn).toBe(123);
      expect(rr.tokensOut).toBe(45);

      // Read back from DB
      const fetched = await results.getInOrg(org.id, rr.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.tokensIn).toBe(123);
      expect(fetched!.tokensOut).toBe(45);
    });

    it("create without token fields → both are null", async () => {
      const { org, run, tc, results } = await setup();
      const rr = await results.create(org.id, {
        runId: run.id,
        testCaseId: tc.id,
        agentResponse: "hello",
        now: 10,
      });

      expect(rr.tokensIn).toBeNull();
      expect(rr.tokensOut).toBeNull();
    });

    it("token fields appear in listForRun", async () => {
      const { org, run, tc, results } = await setup();
      await results.create(org.id, { runId: run.id, testCaseId: tc.id, tokensIn: 200, tokensOut: 80, now: 1 });
      await results.create(org.id, { runId: run.id, testCaseId: tc.id, tokensIn: null, tokensOut: null, now: 2 });

      const list = await results.listForRun(org.id, run.id);
      expect(list).toHaveLength(2);
      expect(list[0].tokensIn).toBe(200);
      expect(list[0].tokensOut).toBe(80);
      expect(list[1].tokensIn).toBeNull();
    });
  });
}
