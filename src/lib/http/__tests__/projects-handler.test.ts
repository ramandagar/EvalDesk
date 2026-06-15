import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer } from "@/lib/http/container";
import { SESSION_COOKIE } from "@/lib/http/request";
import {
  handleCreateProject,
  handleListProjects,
  handleGetProject,
} from "@/lib/http/projects-handler";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = {
  hash: async (pw) => `h:${pw}`,
  compare: async (pw, h) => h === `h:${pw}`,
};
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 3) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const users = usersRepo(tdb.db, tdb.schema);
  const memberships = membershipsRepo(tdb.db, tdb.schema);
  const orgs = organizationsRepo(tdb.db, tdb.schema);
  const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now: () => 1 });
  const auth = authService({ users, memberships, orgs, sessions, hasher: fakeHasher, now: () => 1 });
  const container = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1 });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const b = await auth.signup({ email: "b@x.test", password: "supersecret" });
  return { container, auth, memberships, a, b };
}

function req(
  opts: { method?: string; token?: string; orgId?: string; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.orgId) headers["x-org-id"] = opts.orgId;
  return new Request("http://test/api/v1/projects", {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe("projects HTTP handlers", () => {
  it("POST creates (201) and GET lists it for the owner", async () => {
    const { container, a } = await setup();
    const created = await handleCreateProject(
      req({ method: "POST", token: a.token, orgId: a.org.id, body: { name: "Triage Bot" } }),
      container,
    );
    expect(created.status).toBe(201);
    const { project } = (await created.json()) as { project: { id: string; name: string } };
    expect(project.name).toBe("Triage Bot");

    const listed = await handleListProjects(req({ token: a.token, orgId: a.org.id }), container);
    expect(listed.status).toBe(200);
    const { projects } = (await listed.json()) as { projects: unknown[] };
    expect(projects).toHaveLength(1);
  });

  it("401 without a session cookie", async () => {
    const { container, a } = await setup();
    const res = await handleListProjects(req({ orgId: a.org.id }), container);
    expect(res.status).toBe(401);
  });

  it("400 without the X-Org-Id header", async () => {
    const { container, a } = await setup();
    const res = await handleListProjects(req({ token: a.token }), container);
    expect(res.status).toBe(400);
  });

  it("400 on invalid body (missing name)", async () => {
    const { container, a } = await setup();
    const res = await handleCreateProject(
      req({ method: "POST", token: a.token, orgId: a.org.id, body: { description: "x" } }),
      container,
    );
    expect(res.status).toBe(400);
  });

  it("404 on cross-tenant access (IDOR over HTTP)", async () => {
    const { container, a, b } = await setup();
    const created = await handleCreateProject(
      req({ method: "POST", token: a.token, orgId: a.org.id, body: { name: "Secret" } }),
      container,
    );
    const { project } = (await created.json()) as { project: { id: string } };

    // user B asks for A's project within B's own org → 404
    const res = await handleGetProject(req({ token: b.token, orgId: b.org.id }), container, project.id);
    expect(res.status).toBe(404);

    // user B tries to pass A's org id (not a member) → 404, no enumeration
    const res2 = await handleGetProject(req({ token: b.token, orgId: a.org.id }), container, project.id);
    expect(res2.status).toBe(404);
  });

  it("403 when a viewer tries to create", async () => {
    const { container, auth, memberships, a } = await setup();
    const viewer = await auth.signup({ email: "v@x.test", password: "supersecret" });
    await memberships.create({ orgId: a.org.id, userId: viewer.user.id, role: "viewer", now: 1 });
    const res = await handleCreateProject(
      req({ method: "POST", token: viewer.token, orgId: a.org.id, body: { name: "nope" } }),
      container,
    );
    expect(res.status).toBe(403);
  });
});
