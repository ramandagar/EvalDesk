import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { runResultsRepo } from "@/db/repos/run-results";
import { rubricsRepo } from "@/db/repos/rubrics";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { jobsRepo } from "@/db/repos/jobs";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer, type Container } from "@/lib/http/container";
import { SESSION_COOKIE } from "@/lib/http/request";
import {
  handleReviewQueue,
  handleGetReviewItem,
  handleSubmitVerdict,
  handleSubmitSignoff,
  handleGetCertificate,
} from "@/lib/http/review-handler";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 3) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

function mk(opts: { token?: string; orgId?: string; body?: unknown; query?: string }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.orgId) headers["x-org-id"] = opts.orgId;
  return new Request(`http://t/api/v1/x${opts.query ?? ""}`, {
    method: opts.body !== undefined ? "POST" : "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
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
  const project = await c.projects.create(a.token, a.org.id, { name: "P", agentEndpoint: "https://agent.test" });
  const rubric = await rubricsRepo(tdb.db, tdb.schema).getOrCreateDefault(a.org.id, project.id, 1);
  const run = await c.runs.create(a.token, a.org.id, project.id);
  const tc = await c.testCases.create(a.token, a.org.id, { projectId: project.id, title: "t", input: "q" });
  const rr = await runResultsRepo(tdb.db, tdb.schema).create(a.org.id, { runId: run.id, testCaseId: tc.id, status: "completed", agentResponse: "ans", needsHuman: true, now: 1 });
  await aiScoresRepo(tdb.db, tdb.schema).insertIdempotent(a.org.id, { runResultId: rr.id, model: "gpt-4o", label: "pass", confidence: 0.4, disagreement: 0.5, rubricVersionId: rubric.id, idempotencyKey: "ai1", now: 1 });
  return { c, a, run, rr };
}

describe("review HTTP handlers", () => {
  it("GET queue (blind) returns items with no AI/peer fields", async () => {
    const { c, a, run } = await setup();
    const res = await handleReviewQueue(mk({ token: a.token, orgId: a.org.id, query: "?blind=true" }), c, run.id);
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(items).toHaveLength(1);
    expect(items[0].blind).toBe(true);
    expect("aiScores" in items[0]).toBe(false);
  });

  it("GET result (non-blind) includes AI scores + queue reason", async () => {
    const { c, a, rr } = await setup();
    const res = await handleGetReviewItem(mk({ token: a.token, orgId: a.org.id }), c, rr.id);
    const { item } = (await res.json()) as { item: { aiScores: unknown[]; needsHumanReasons: string[] } };
    expect(item.aiScores).toHaveLength(1);
    expect(item.needsHumanReasons).toContain("low-confidence");
  });

  it("POST verdict returns 201 on first write, 200 on idempotent retry", async () => {
    const { c, a, rr } = await setup();
    const first = await handleSubmitVerdict(mk({ token: a.token, orgId: a.org.id, body: { label: "pass", attemptId: "att1" } }), c, rr.id);
    expect(first.status).toBe(201);
    const retry = await handleSubmitVerdict(mk({ token: a.token, orgId: a.org.id, body: { label: "fail", attemptId: "att1" } }), c, rr.id);
    expect(retry.status).toBe(200);
  });

  it("POST verdict with an out-of-rubric label is 400", async () => {
    const { c, a, rr } = await setup();
    const res = await handleSubmitVerdict(mk({ token: a.token, orgId: a.org.id, body: { label: "amazing", attemptId: "z" } }), c, rr.id);
    expect(res.status).toBe(400);
  });

  it("POST signoff enqueues a run.finalize job", async () => {
    const { c, a, run } = await setup();
    const res = await handleSubmitSignoff(mk({ token: a.token, orgId: a.org.id, body: { decision: "approve" } }), c, run.id);
    expect(res.status).toBe(200);
    // drain all queued jobs (run.create enqueued run.execute; signoff enqueued run.finalize)
    const jobs = jobsRepo(tdb.db, tdb.schema);
    const claimed = [await jobs.claim("w", 999), await jobs.claim("w", 999)].filter(Boolean);
    const finalize = claimed.find((j) => j!.type === "run.finalize");
    expect(finalize).toBeTruthy();
    expect(finalize!.payload).toEqual({ runId: run.id });
  });

  it("GET certificate is 404 before the run is signed", async () => {
    const { c, a, run } = await setup();
    const res = await handleGetCertificate(mk({ token: a.token, orgId: a.org.id }), c, run.id);
    expect(res.status).toBe(404);
  });
});
