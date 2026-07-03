import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { projectsRepo } from "../repos/projects";
import { testCasesRepo } from "../repos/test-cases";

const available: Record<string, boolean> = {
  sqlite: true,
  postgres: !!process.env.TEST_DATABASE_URL,
};

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`test_cases.context column — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    it("create with context → read back the same context string", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const cases = testCasesRepo(tdb!.db, tdb!.schema);

      const org = await orgs.create({ name: "A", slug: "a-ctx", now: 1 });
      const project = await projects.create(org.id, { name: "P", now: 1 });

      const contextText = "According to the 2024 annual report, revenue increased by 15% year-over-year.";
      const tc = await cases.create(org.id, {
        projectId: project.id,
        title: "RAG Q",
        input: "What was the revenue growth?",
        expectedOutput: "15% YoY",
        context: contextText,
        now: 10,
      });

      expect(tc.context).toBe(contextText);

      // Read back from DB
      const fetched = await cases.getInOrg(org.id, tc.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.context).toBe(contextText);
    });

    it("create without context → context is null", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const cases = testCasesRepo(tdb!.db, tdb!.schema);

      const org = await orgs.create({ name: "B", slug: "b-ctx", now: 1 });
      const project = await projects.create(org.id, { name: "Q", now: 1 });

      const tc = await cases.create(org.id, {
        projectId: project.id,
        title: "Non-RAG Q",
        input: "General question",
        now: 10,
      });

      expect(tc.context).toBeNull();
    });

    it("context appears in listForProject results", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const cases = testCasesRepo(tdb!.db, tdb!.schema);

      const org = await orgs.create({ name: "C", slug: "c-ctx", now: 1 });
      const project = await projects.create(org.id, { name: "R", now: 1 });

      await cases.create(org.id, {
        projectId: project.id,
        title: "With context",
        input: "q1",
        context: "source docs here",
        now: 1,
      });
      await cases.create(org.id, {
        projectId: project.id,
        title: "Without context",
        input: "q2",
        now: 2,
      });

      const list = await cases.listForProject(org.id, project.id);
      expect(list).toHaveLength(2);
      expect(list.find((c) => c.title === "With context")!.context).toBe("source docs here");
      expect(list.find((c) => c.title === "Without context")!.context).toBeNull();
    });
  });
}
