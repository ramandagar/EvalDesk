import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { jobsRepo } from "@/db/repos/jobs";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer, type Container } from "@/lib/http/container";
import { SESSION_COOKIE } from "@/lib/http/request";
import { handleCreateRun, handleGetRun, handleListRuns } from "@/lib/http/runs-handler";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 2) } };

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
  const jobs = jobsRepo(tdb.db, tdb.schema);
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  return { container, jobs, a };
}

function mk(opts: { method?: string; token?: string; orgId?: string; body?: unknown; query?: string }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.orgId) headers["x-org-id"] = opts.orgId;
  return new Request(`http://t/api/v1/runs${opts.query ?? ""}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function makeProject(c: Container, token: string, orgId: string, withEndpoint = true): Promise<string> {
  const p = await c.projects.create(token, orgId, {
    name: "P",
    agentEndpoint: withEndpoint ? "https://agent.test" : null,
  });
  return p.id;
}

describe("runs HTTP handlers", () => {
  it("POST creates a queued run (202) and enqueues a run.execute job", async () => {
    const { container, jobs, a } = await setup();
    const projectId = await makeProject(container, a.token, a.org.id);

    const res = await handleCreateRun(
      mk({ method: "POST", token: a.token, orgId: a.org.id, body: { projectId } }),
      container,
    );
    expect(res.status).toBe(202);
    const { run } = (await res.json()) as { run: { id: string; status: string } };
    expect(run.status).toBe("queued");

    // a job was enqueued for the worker to pick up
    const claimed = await jobs.claim("w1", 999);
    expect(claimed?.type).toBe("run.execute");
    expect(claimed?.payload).toEqual({ runId: run.id, projectId });

    // status is pollable
    const got = await handleGetRun(mk({ token: a.token, orgId: a.org.id }), container, run.id);
    expect(got.status).toBe(200);
    expect(((await got.json()) as { run: { status: string } }).run.status).toBe("queued");
  });

  it("400 when the project has no agent endpoint", async () => {
    const { container, a } = await setup();
    const projectId = await makeProject(container, a.token, a.org.id, false);
    const res = await handleCreateRun(
      mk({ method: "POST", token: a.token, orgId: a.org.id, body: { projectId } }),
      container,
    );
    expect(res.status).toBe(400);
  });

  it("lists runs for a project", async () => {
    const { container, a } = await setup();
    const projectId = await makeProject(container, a.token, a.org.id);
    await handleCreateRun(mk({ method: "POST", token: a.token, orgId: a.org.id, body: { projectId } }), container);
    const res = await handleListRuns(mk({ token: a.token, orgId: a.org.id, query: `?projectId=${projectId}` }), container);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { runs: unknown[] }).runs).toHaveLength(1);
  });
});
