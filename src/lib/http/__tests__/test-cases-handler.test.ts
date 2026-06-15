import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer, type Container } from "@/lib/http/container";
import { SESSION_COOKIE } from "@/lib/http/request";
import { handleCreateProject } from "@/lib/http/projects-handler";
import {
  handleCreateTestCase,
  handleListTestCases,
  handleGetTestCase,
  handleDeleteTestCase,
} from "@/lib/http/test-cases-handler";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 5) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now: () => 1 });
  const auth = authService({
    users: usersRepo(tdb.db, tdb.schema),
    memberships: membershipsRepo(tdb.db, tdb.schema),
    orgs: organizationsRepo(tdb.db, tdb.schema),
    sessions,
    hasher: fakeHasher,
    now: () => 1,
  });
  const container = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1 });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const b = await auth.signup({ email: "b@x.test", password: "supersecret" });
  return { container, auth, memberships: membershipsRepo(tdb.db, tdb.schema), a, b };
}

function req(url: string, opts: { method?: string; token?: string; orgId?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.orgId) headers["x-org-id"] = opts.orgId;
  return new Request(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function makeProject(c: Container, token: string, orgId: string): Promise<string> {
  const res = await handleCreateProject(
    req("http://t/api/v1/projects", { method: "POST", token, orgId, body: { name: "P" } }),
    c,
  );
  return ((await res.json()) as { project: { id: string } }).project.id;
}

describe("test-cases HTTP handlers", () => {
  it("creates (201), lists, gets, and deletes within the org", async () => {
    const { container, a } = await setup();
    const projectId = await makeProject(container, a.token, a.org.id);

    const created = await handleCreateTestCase(
      req("http://t/api/v1/test-cases", {
        method: "POST",
        token: a.token,
        orgId: a.org.id,
        body: { projectId, title: "chest pain", input: "I have chest pain" },
      }),
      container,
    );
    expect(created.status).toBe(201);
    const { testCase } = (await created.json()) as { testCase: { id: string } };

    const listed = await handleListTestCases(
      req(`http://t/api/v1/test-cases?projectId=${projectId}`, { token: a.token, orgId: a.org.id }),
      container,
    );
    expect(((await listed.json()) as { testCases: unknown[] }).testCases).toHaveLength(1);

    const got = await handleGetTestCase(
      req("http://t/api/v1/test-cases", { token: a.token, orgId: a.org.id }),
      container,
      testCase.id,
    );
    expect(got.status).toBe(200);

    const del = await handleDeleteTestCase(
      req("http://t/api/v1/test-cases", { token: a.token, orgId: a.org.id }),
      container,
      testCase.id,
    );
    expect(del.status).toBe(200);
  });

  it("404 when creating against another org's project (IDOR)", async () => {
    const { container, a, b } = await setup();
    const projectId = await makeProject(container, a.token, a.org.id);
    // B tries to add a test case to A's project, via B's own org
    const res = await handleCreateTestCase(
      req("http://t/api/v1/test-cases", {
        method: "POST",
        token: b.token,
        orgId: b.org.id,
        body: { projectId, title: "x", input: "y" },
      }),
      container,
    );
    expect(res.status).toBe(404);
  });

  it("404 cross-tenant get", async () => {
    const { container, a, b } = await setup();
    const projectId = await makeProject(container, a.token, a.org.id);
    const created = await handleCreateTestCase(
      req("http://t/api/v1/test-cases", {
        method: "POST",
        token: a.token,
        orgId: a.org.id,
        body: { projectId, title: "t", input: "i" },
      }),
      container,
    );
    const { testCase } = (await created.json()) as { testCase: { id: string } };
    const res = await handleGetTestCase(
      req("http://t/api/v1/test-cases", { token: b.token, orgId: b.org.id }),
      container,
      testCase.id,
    );
    expect(res.status).toBe(404);
  });

  it("403 when a viewer tries to create", async () => {
    const { container, auth, memberships, a } = await setup();
    const projectId = await makeProject(container, a.token, a.org.id);
    const viewer = await auth.signup({ email: "v@x.test", password: "supersecret" });
    await memberships.create({ orgId: a.org.id, userId: viewer.user.id, role: "viewer", now: 1 });
    const res = await handleCreateTestCase(
      req("http://t/api/v1/test-cases", {
        method: "POST",
        token: viewer.token,
        orgId: a.org.id,
        body: { projectId, title: "x", input: "y" },
      }),
      container,
    );
    expect(res.status).toBe(403);
  });
});
