import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { apiKeysRepo } from "@/db/repos/api-keys";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { projectsRepo } from "@/db/repos/projects";
import { testCasesRepo } from "@/db/repos/test-cases";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { guard } from "@/lib/auth/guard";
import { importService } from "@/lib/services/import-service";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const now = () => 1;
  const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now });
  const auth = authService({
    users: usersRepo(tdb.db, tdb.schema),
    memberships: membershipsRepo(tdb.db, tdb.schema),
    orgs: organizationsRepo(tdb.db, tdb.schema),
    sessions,
    hasher: fakeHasher,
    now,
  });
  const projects = projectsRepo(tdb.db, tdb.schema);
  const testCases = testCasesRepo(tdb.db, tdb.schema);
  const svc = importService({ guard: guard({ sessions, memberships: membershipsRepo(tdb.db, tdb.schema), users: usersRepo(tdb.db, tdb.schema), apiKeys: apiKeysRepo(tdb.db, tdb.schema), now: () => 1 }), projects, testCases, now });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const b = await auth.signup({ email: "b@x.test", password: "supersecret" });
  const project = await projects.create(a.org.id, { name: "P", now: 1 });
  return { svc, testCases, a, b, project };
}

describe("importService", () => {
  it("imports a deepeval dataset into the project's test cases (appending order)", async () => {
    const { svc, testCases, a, project } = await setup();
    await testCases.create(a.org.id, { projectId: project.id, title: "existing", input: "x", now: 1 }); // order 0
    const raw = JSON.stringify({ goldens: [{ input: "q1", expected_output: "a1" }, { input: "q2", expected_output: "a2" }] });
    const result = await svc.importDataset(a.token, a.org.id, project.id, raw);
    expect(result).toEqual({ format: "deepeval", imported: 2 });

    const cases = await testCases.listForProject(a.org.id, project.id);
    expect(cases).toHaveLength(3);
    expect(cases.map((c) => c.input)).toEqual(["x", "q1", "q2"]);
    expect(cases[2].order).toBe(2); // appended after existing
  });

  it("404s when importing into another org's project (IDOR-safe)", async () => {
    const { svc, b, a, project } = await setup();
    const raw = JSON.stringify({ goldens: [{ input: "q", expected_output: "a" }] });
    await expect(svc.importDataset(b.token, a.org.id, project.id, raw)).rejects.toMatchObject({ status: 404 });
  });

  it("422 on an unrecognized format", async () => {
    const { svc, a, project } = await setup();
    await expect(svc.importDataset(a.token, a.org.id, project.id, '{"nonsense":true}')).rejects.toMatchObject({ status: 422 });
  });

  it("400 with a line number on malformed openai-evals jsonl", async () => {
    const { svc, a, project } = await setup();
    const raw = JSON.stringify({ input: [{ role: "user", content: "x" }], ideal: "y" }) + "\n{ broken";
    await expect(svc.importDataset(a.token, a.org.id, project.id, raw)).rejects.toMatchObject({ status: 400 });
  });

  it("413 when the dataset exceeds the size cap", async () => {
    const { svc, a, project } = await setup();
    const huge = JSON.stringify({ goldens: [{ input: "x".repeat(6 * 1024 * 1024), expected_output: "a" }] });
    await expect(svc.importDataset(a.token, a.org.id, project.id, huge)).rejects.toMatchObject({ status: 413 });
  });

  it("401 for an unauthenticated caller", async () => {
    const { svc, a, project } = await setup();
    await expect(svc.importDataset(undefined, a.org.id, project.id, '{"goldens":[{"input":"q"}]}')).rejects.toMatchObject({ status: 401 });
  });
});
