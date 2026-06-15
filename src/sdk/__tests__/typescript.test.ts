import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { runsRepo } from "@/db/repos/runs";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer, type Container } from "@/lib/http/container";
import { handleMe } from "@/lib/http/me-handler";
import { handleCreateProject } from "@/lib/http/projects-handler";
import { handleCreateTestCase } from "@/lib/http/test-cases-handler";
import { handleCreateRun, handleGetRun } from "@/lib/http/runs-handler";
import { handleImport } from "@/lib/http/imports-handler";
import { EvalDesk, assertRunPasses, EvalDeskError, type Run } from "../typescript";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 4) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

/** A fetch impl that routes /api/v1 Requests to the real HTTP handlers (no network). */
function makeRouter(c: Container): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname.replace(/^\/api\/v1/, "");
    const req = new Request(url, init);
    const m = init.method ?? "GET";
    if (path === "/me") return handleMe(req, c);
    if (path === "/projects" && m === "POST") return handleCreateProject(req, c);
    if (path === "/test-cases" && m === "POST") return handleCreateTestCase(req, c);
    if (path === "/runs" && m === "POST") return handleCreateRun(req, c);
    if (path === "/imports" && m === "POST") return handleImport(req, c);
    const runGet = path.match(/^\/runs\/([^/]+)$/);
    if (runGet && m === "GET") return handleGetRun(req, c, runGet[1]);
    return new Response(JSON.stringify({ error: "not routed" }), { status: 404 });
  }) as unknown as typeof fetch;
}

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
  const c = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const sdk = new EvalDesk({ baseUrl: "http://t", token: a.token, org: a.org.id, fetchImpl: makeRouter(c) });
  return { sdk, a, c };
}

describe("TS SDK — contract against the real handlers", () => {
  it("me() resolves identity + orgs", async () => {
    const { sdk, a } = await setup();
    const me = await sdk.me();
    expect(me.user.email).toBe("a@x.test");
    expect(me.orgs.some((o) => o.id === a.org.id)).toBe(true);
  });

  it("creates a project, imports cases, and starts a run (202 → queued)", async () => {
    const { sdk } = await setup();
    const project = await sdk.projects.create({ name: "P", agentEndpoint: "https://agent.test" });
    const imp = await sdk.imports.create(project.id, JSON.stringify({ goldens: [{ input: "q", expected_output: "a" }] }));
    expect(imp).toEqual({ format: "deepeval", imported: 1 });

    const run = await sdk.runs.create(project.id);
    expect(run.status).toBe("queued");
    expect(run.id).toBeTruthy();
  });

  it("waitForRun polls until terminal (deterministic clock/sleep)", async () => {
    const { sdk, a, c } = await setup();
    const project = await sdk.projects.create({ name: "P", agentEndpoint: "https://agent.test" });
    const run = await sdk.runs.create(project.id);

    // simulate the worker finishing the run between polls
    let polls = 0;
    const original = sdk.runs.get.bind(sdk.runs);
    sdk.runs.get = async (id: string) => {
      polls += 1;
      if (polls >= 2) await runsRepo(tdb.db, tdb.schema).update(a.org.id, id, { status: "completed", passCount: 1, totalCases: 1 });
      return original(id);
    };
    void c;

    const finished = await run.wait({ pollMs: 0, clock: () => polls * 1000, sleep: async () => {} });
    expect(finished.status).toBe("completed");
    expect(polls).toBeGreaterThanOrEqual(2);
  });

  it("times out if a run never finishes", async () => {
    const { sdk } = await setup();
    const project = await sdk.projects.create({ name: "P", agentEndpoint: "https://agent.test" });
    const run = await sdk.runs.create(project.id);
    let t = 0;
    await expect(run.wait({ timeoutMs: 10, pollMs: 0, clock: () => (t += 100), sleep: async () => {} })).rejects.toMatchObject({ status: 408 });
  });

  it("surfaces server errors as EvalDeskError (e.g. 400 no endpoint)", async () => {
    const { sdk } = await setup();
    const project = await sdk.projects.create({ name: "NoEndpoint" });
    await expect(sdk.runs.create(project.id)).rejects.toBeInstanceOf(EvalDeskError);
  });
});

describe("assertRunPasses — CI gate", () => {
  const run = (over: Partial<Run>): Run => ({
    id: "r", projectId: "p", status: "completed", totalCases: 10, passCount: 8, failCount: 1, partialCount: 1, unratedCount: 0, passRate: 80, ...over,
  });

  it("passes when pass-rate meets the bar", () => {
    expect(() => assertRunPasses(run({}), { minPassRate: 0.8 })).not.toThrow();
  });
  it("throws below the pass-rate bar", () => {
    expect(() => assertRunPasses(run({ passCount: 5, failCount: 5, partialCount: 0 }), { minPassRate: 0.8 })).toThrow(/pass rate/);
  });
  it("throws when failures exceed the cap", () => {
    expect(() => assertRunPasses(run({ failCount: 3 }), { maxFailures: 2 })).toThrow(/failures/);
  });
});
