import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { runResultsRepo } from "@/db/repos/run-results";
import { rubricsRepo } from "@/db/repos/rubrics";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer, type Container } from "@/lib/http/container";
import { SESSION_COOKIE } from "@/lib/http/request";
import { handleRunReport, handleExportReport, handleSubmitVerdict } from "@/lib/http/review-handler";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 3) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

function mk(opts: { token?: string; orgId?: string; query?: string }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.orgId) headers["x-org-id"] = opts.orgId;
  return new Request(`http://t/api/v1/x${opts.query ?? ""}`, { method: "GET", headers });
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
  const c: Container = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const project = await c.projects.create(a.token, a.org.id, { name: "Med Bot", agentEndpoint: "https://agent.test" });
  const rubric = await rubricsRepo(tdb.db, tdb.schema).getOrCreateDefault(a.org.id, project.id, 1);
  const run = await c.runs.create(a.token, a.org.id, project.id);
  const tc = await c.testCases.create(a.token, a.org.id, { projectId: project.id, title: "chest pain", input: "I have chest pain" });
  const rr = await runResultsRepo(tdb.db, tdb.schema).create(a.org.id, { runId: run.id, testCaseId: tc.id, status: "completed", agentResponse: "call 911", needsHuman: true, now: 1 });
  await aiScoresRepo(tdb.db, tdb.schema).insertIdempotent(a.org.id, { runResultId: rr.id, model: "gpt-4o", label: "pass", confidence: 0.4, disagreement: 0.5, rubricVersionId: rubric.id, idempotencyKey: "ai1", now: 1 });
  return { c, a, run, rr };
}

describe("run report + export handlers", () => {
  it("GET /runs/:id/results returns per-result testcase + agent response + ai scores + human verdicts", async () => {
    const { c, a, run, rr } = await setup();
    // before a human verdict: aiScores present, humanRatings empty
    const res1 = await handleRunReport(mk({ token: a.token, orgId: a.org.id }), c, run.id);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { run: { id: string }; results: Array<Record<string, unknown>> };
    expect(body1.run.id).toBe(run.id);
    expect(body1.results).toHaveLength(1);
    const r1 = body1.results[0];
    expect(r1.input).toBe("I have chest pain");
    expect(r1.agentResponse).toBe("call 911");
    expect((r1.aiScores as unknown[])).toHaveLength(1);
    expect((r1.humanRatings as unknown[])).toHaveLength(0);

    // submit a human verdict → humanRatings now populated
    await handleSubmitVerdict(
      new Request(`http://t/api/v1/x`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${a.token}`, "x-org-id": a.org.id },
        body: JSON.stringify({ label: "pass", attemptId: "att1" }),
      }),
      c,
      rr.id,
    );

    const res2 = await handleRunReport(mk({ token: a.token, orgId: a.org.id }), c, run.id);
    const body2 = (await res2.json()) as { results: Array<{ humanRatings: Array<{ label: string }>; aiScores: Array<{ label: string }> }> };
    expect(body2.results[0].humanRatings[0].label).toBe("pass");
    expect(body2.results[0].aiScores[0].label).toBe("pass");
  });

  it("GET /runs/:id/report?format=json returns application/json with run + results", async () => {
    const { c, a, run } = await setup();
    const res = await handleExportReport(mk({ token: a.token, orgId: a.org.id, query: "?format=json" }), c, run.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { run: { id: string }; results: unknown[] };
    expect(body.run.id).toBe(run.id);
    expect(body.results).toHaveLength(1);
  });

  it("GET /runs/:id/report?format=csv returns a text/csv attachment", async () => {
    const { c, a, run } = await setup();
    const res = await handleExportReport(mk({ token: a.token, orgId: a.org.id, query: "?format=csv" }), c, run.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    expect(text.startsWith("title,input,agent_response")).toBe(true);
    expect(text).toContain("call 911");
  });

  it("GET /runs/:id/report (default html) returns a self-contained text/html document", async () => {
    const { c, a, run } = await setup();
    const res = await handleExportReport(mk({ token: a.token, orgId: a.org.id }), c, run.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("EvalDesk");
    expect(html).toContain("Med Bot");
  });

  it("rejects an unauthenticated caller (401) and a cross-tenant caller (404)", async () => {
    const { c, a, run } = await setup();
    // a second user in a different org
    const now = () => 1;
    const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now });
    const auth = authService({ users: usersRepo(tdb.db, tdb.schema), memberships: membershipsRepo(tdb.db, tdb.schema), orgs: organizationsRepo(tdb.db, tdb.schema), sessions, hasher: fakeHasher, now });
    const b = await auth.signup({ email: "b@x.test", password: "supersecret" });

    expect((await handleRunReport(mk({ orgId: a.org.id }), c, run.id)).status).toBe(401);
    // B passes A's org id but is not a member → 404, no enumeration
    expect((await handleRunReport(mk({ token: b.token, orgId: a.org.id }), c, run.id)).status).toBe(404);
    expect((await handleExportReport(mk({ token: b.token, orgId: a.org.id }), c, run.id)).status).toBe(404);
  });
});
