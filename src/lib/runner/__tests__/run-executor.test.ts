import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../../tests/helpers/db";
import { organizationsRepo } from "@/db/repos/organizations";
import { projectsRepo } from "@/db/repos/projects";
import { testCasesRepo } from "@/db/repos/test-cases";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { executeRun, type ExecutorDeps } from "@/lib/runner/run-executor";
import type { AgentCallResult } from "@/lib/runner/agent-runner";

const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`run executor — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("runs every test case, stores results, finalizes the run", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const testCases = testCasesRepo(tdb!.db, tdb!.schema);
      const runs = runsRepo(tdb!.db, tdb!.schema);
      const runResults = runResultsRepo(tdb!.db, tdb!.schema);

      const org = await orgs.create({ name: "O", slug: "o", now: 1 });
      const project = await projects.create(org.id, { name: "Bot", now: 1 });
      await testCases.create(org.id, { projectId: project.id, title: "1", input: "ok one", order: 0, now: 1 });
      await testCases.create(org.id, { projectId: project.id, title: "2", input: "ok two", order: 1, now: 1 });
      await testCases.create(org.id, { projectId: project.id, title: "3", input: "boom three", order: 2, now: 1 });

      // fake agent: errors when the input mentions "boom"
      const callAgent = async (input: string): Promise<AgentCallResult> =>
        input.includes("boom")
          ? { response: null, error: "HTTP 500: upstream", timeMs: 7 }
          : { response: `answer to: ${input}`, timeMs: 12 };

      const run = await runs.create(org.id, { projectId: project.id, status: "queued", now: 1 });

      const deps: ExecutorDeps = { testCases, runs, runResults, callAgent, now: () => 1000 };
      const summary = await executeRun(deps, {
        orgId: org.id,
        runId: run.id,
        projectId: project.id,
        agentConfig: { endpoint: "https://agent.test", type: "custom" },
      });

      expect(summary).toEqual({ runId: run.id, total: 3, completed: 2, errors: 1 });

      const results = await runResults.listForRun(org.id, run.id);
      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.status === "completed")).toHaveLength(2);
      expect(results.filter((r) => r.status === "error")).toHaveLength(1);
      expect(results.every((r) => r.needsHuman)).toBe(true);
      const errored = results.find((r) => r.status === "error");
      expect(errored?.errorMessage).toMatch(/upstream/);
      expect(errored?.agentResponse).toBeNull();

      const finalized = await runs.getInOrg(org.id, run.id);
      expect(finalized?.status).toBe("completed");
      expect(finalized?.totalCases).toBe(3);
      expect(finalized?.unratedCount).toBe(3);
      expect(finalized?.completedAt).toBe(1000);
    });
  });
}
