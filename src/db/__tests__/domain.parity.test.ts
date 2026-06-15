import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { projectsRepo } from "../repos/projects";
import { testCasesRepo } from "../repos/test-cases";
import { secretsRepo } from "../repos/secrets";

const available: Record<string, boolean> = {
  sqlite: true,
  postgres: !!process.env.TEST_DATABASE_URL,
};

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`domain repos org-scoping — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    async function twoOrgs() {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const orgA = await orgs.create({ name: "A", slug: "a", now: 1 });
      const orgB = await orgs.create({ name: "B", slug: "b", now: 1 });
      return { orgA, orgB };
    }

    it("projects: a project is invisible/immutable across org boundaries", async () => {
      const { orgA, orgB } = await twoOrgs();
      const projects = projectsRepo(tdb!.db, tdb!.schema);

      const p = await projects.create(orgA.id, { name: "Triage Bot", now: 10 });
      expect(p.orgId).toBe(orgA.id);
      expect(p.agentMethod).toBe("POST"); // default
      expect(p.defaultModel).toBe("gpt-4o-mini"); // default

      // same org sees it
      expect((await projects.getInOrg(orgA.id, p.id))?.id).toBe(p.id);
      // OTHER org cannot read it (IDOR → null, becomes 404 at the service)
      expect(await projects.getInOrg(orgB.id, p.id)).toBeNull();
      // OTHER org cannot update or delete it
      expect(await projects.update(orgB.id, p.id, { name: "hacked" }, 20)).toBeNull();
      expect(await projects.delete(orgB.id, p.id)).toBe(false);
      // it is untouched
      expect((await projects.getInOrg(orgA.id, p.id))?.name).toBe("Triage Bot");

      // owner can update + delete
      const updated = await projects.update(orgA.id, p.id, { name: "Triage v2" }, 30);
      expect(updated?.name).toBe("Triage v2");
      expect(updated?.updatedAt).toBe(30);
      expect(await projects.delete(orgA.id, p.id)).toBe(true);
      expect(await projects.getInOrg(orgA.id, p.id)).toBeNull();
    });

    it("projects: list is scoped to the org", async () => {
      const { orgA, orgB } = await twoOrgs();
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      await projects.create(orgA.id, { name: "A1", now: 1 });
      await projects.create(orgA.id, { name: "A2", now: 2 });
      await projects.create(orgB.id, { name: "B1", now: 1 });
      expect((await projects.listForOrg(orgA.id)).map((p) => p.name)).toEqual(["A1", "A2"]);
      expect((await projects.listForOrg(orgB.id)).map((p) => p.name)).toEqual(["B1"]);
    });

    it("test cases: scoped to org + project, cross-org read returns null", async () => {
      const { orgA, orgB } = await twoOrgs();
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const cases = testCasesRepo(tdb!.db, tdb!.schema);
      const p = await projects.create(orgA.id, { name: "P", now: 1 });

      const tc = await cases.create(orgA.id, {
        projectId: p.id,
        title: "chest pain",
        input: "I have chest pain",
        expectedOutput: "call emergency",
        now: 5,
      });
      expect(tc.order).toBe(0);
      expect((await cases.listForProject(orgA.id, p.id)).map((c) => c.id)).toEqual([tc.id]);
      expect(await cases.getInOrg(orgB.id, tc.id)).toBeNull(); // cross-org → null
      expect((await cases.listForProject(orgB.id, p.id)).length).toBe(0);
    });

    it("secrets: ciphertext is org-scoped, upserts, never crosses tenants", async () => {
      const { orgA, orgB } = await twoOrgs();
      const secrets = secretsRepo(tdb!.db, tdb!.schema);

      await secrets.put({ orgId: orgA.id, refType: "project", refId: "p1", name: "agent_api_key", ciphertext: "v1:blob", now: 1 });
      expect(await secrets.get(orgA.id, "project", "p1", "agent_api_key")).toBe("v1:blob");
      // upsert replaces
      await secrets.put({ orgId: orgA.id, refType: "project", refId: "p1", name: "agent_api_key", ciphertext: "v1:blob2", now: 2 });
      expect(await secrets.get(orgA.id, "project", "p1", "agent_api_key")).toBe("v1:blob2");
      // another org cannot read it
      expect(await secrets.get(orgB.id, "project", "p1", "agent_api_key")).toBeNull();
    });
  });
}
