import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer, type Container } from "@/lib/http/container";
import { runResultsRepo } from "@/db/repos/run-results";
import { SESSION_COOKIE } from "@/lib/http/request";
import {
  handleListProjects,
  handleCreateProject,
  handleGetProject,
  handleUpdateProject,
  handleDeleteProject,
} from "@/lib/http/projects-handler";
import {
  handleListTestCases,
  handleCreateTestCase,
  handleGetTestCase,
  handleDeleteTestCase,
} from "@/lib/http/test-cases-handler";
import { handleListRuns, handleCreateRun, handleGetRun } from "@/lib/http/runs-handler";
import {
  handleReviewQueue,
  handleGetReviewItem,
  handleSubmitVerdict,
  handleSubmitSignoff,
  handleGetCertificate,
  handleGetCalibration,
  handleRunReport,
  handleExportReport,
  handleRunCoverage,
} from "@/lib/http/review-handler";
import { handleMe } from "@/lib/http/me-handler";
import { handleListWebhooks, handleCreateWebhook } from "@/lib/http/webhooks-handler";
import { handleListMembers, handleAddMember, handleUpdateMember, handleRemoveMember } from "@/lib/http/members-handler";
import { handleAnalytics } from "@/lib/http/analytics-handler";
import { handleCompare } from "@/lib/http/review-handler";
import { handleListApiKeys, handleCreateApiKey, handleRevokeApiKey } from "@/lib/http/api-keys-handler";
import { handleImport } from "@/lib/http/imports-handler";
import { handleListAudit } from "@/lib/http/audit-handler";
import { handleGenerateProbes } from "@/lib/http/probes-handler";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 9) } };

let tdb: TestDb;
let c: Container;
let aToken: string, aOrg: string, bToken: string, projectId: string, testCaseId: string, runId: string, resultId: string;

beforeEach(async () => {
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
  c = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1 });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const b = await auth.signup({ email: "b@x.test", password: "supersecret" });
  aToken = a.token;
  aOrg = a.org.id;
  bToken = b.token;
  const p = await c.projects.create(aToken, aOrg, { name: "P", agentEndpoint: "https://agent.test" });
  projectId = p.id;
  const tc = await c.testCases.create(aToken, aOrg, { projectId, title: "t", input: "i" });
  testCaseId = tc.id;
  const run = await c.runs.create(aToken, aOrg, projectId);
  runId = run.id;
  const rr = await runResultsRepo(tdb.db, tdb.schema).create(aOrg, {
    runId,
    testCaseId,
    status: "completed",
    agentResponse: "x",
    needsHuman: true,
    now: 1,
  });
  resultId = rr.id;
});

afterEach(async () => {
  await tdb.cleanup();
});

function mk(token: string | undefined, orgId: string | undefined, body?: unknown, query = "") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  if (orgId) headers["x-org-id"] = orgId;
  return new Request(`http://t/api/v1/x${query}`, {
    method: body !== undefined ? "POST" : "GET",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// Every protected endpoint, parameterized by (token, orgId).
function endpoints() {
  return [
    { name: "GET /projects", run: (t?: string, o?: string) => handleListProjects(mk(t, o), c) },
    { name: "POST /projects", run: (t?: string, o?: string) => handleCreateProject(mk(t, o, { name: "x" }), c) },
    { name: "GET /projects/:id", run: (t?: string, o?: string) => handleGetProject(mk(t, o), c, projectId) },
    { name: "PUT /projects/:id", run: (t?: string, o?: string) => handleUpdateProject(mk(t, o, { name: "x" }), c, projectId) },
    { name: "DELETE /projects/:id", run: (t?: string, o?: string) => handleDeleteProject(mk(t, o), c, projectId) },
    { name: "GET /test-cases", run: (t?: string, o?: string) => handleListTestCases(mk(t, o, undefined, `?projectId=${projectId}`), c) },
    { name: "POST /test-cases", run: (t?: string, o?: string) => handleCreateTestCase(mk(t, o, { projectId, title: "x", input: "y" }), c) },
    { name: "GET /test-cases/:id", run: (t?: string, o?: string) => handleGetTestCase(mk(t, o), c, testCaseId) },
    { name: "DELETE /test-cases/:id", run: (t?: string, o?: string) => handleDeleteTestCase(mk(t, o), c, testCaseId) },
    { name: "GET /runs", run: (t?: string, o?: string) => handleListRuns(mk(t, o, undefined, `?projectId=${projectId}`), c) },
    { name: "POST /runs", run: (t?: string, o?: string) => handleCreateRun(mk(t, o, { projectId }), c) },
    { name: "GET /runs/:id", run: (t?: string, o?: string) => handleGetRun(mk(t, o), c, runId) },
    { name: "GET /runs/:id/queue", run: (t?: string, o?: string) => handleReviewQueue(mk(t, o), c, runId) },
    { name: "POST /runs/:id/signoff", run: (t?: string, o?: string) => handleSubmitSignoff(mk(t, o, { decision: "approve" }), c, runId) },
    { name: "GET /runs/:id/certificate", run: (t?: string, o?: string) => handleGetCertificate(mk(t, o), c, runId) },
    { name: "GET /runs/:id/results", run: (t?: string, o?: string) => handleRunReport(mk(t, o), c, runId) },
    { name: "GET /runs/:id/report", run: (t?: string, o?: string) => handleExportReport(mk(t, o), c, runId) },
    { name: "GET /runs/:id/coverage", run: (t?: string, o?: string) => handleRunCoverage(mk(t, o, undefined, "?suite=hipaa"), c, runId) },
    { name: "GET /results/:id", run: (t?: string, o?: string) => handleGetReviewItem(mk(t, o), c, resultId) },
    { name: "POST /results/:id/verdicts", run: (t?: string, o?: string) => handleSubmitVerdict(mk(t, o, { label: "pass", attemptId: "a1" }), c, resultId) },
    { name: "GET /projects/:id/calibration", run: (t?: string, o?: string) => handleGetCalibration(mk(t, o), c, projectId) },
    { name: "POST /projects/:id/probes", run: (t?: string, o?: string) => handleGenerateProbes(mk(t, o, { type: "jailbreak", count: 2 }), c, projectId) },
    { name: "GET /webhooks", run: (t?: string, o?: string) => handleListWebhooks(mk(t, o), c) },
    { name: "POST /webhooks", run: (t?: string, o?: string) => handleCreateWebhook(mk(t, o, { url: "https://hooks.test/x", events: ["run.completed"] }), c) },
    { name: "POST /imports", run: (t?: string, o?: string) => handleImport(mk(t, o, { projectId, data: '{"goldens":[{"input":"q","expected_output":"a"}]}' }), c) },
    { name: "GET /api-keys", run: (t?: string, o?: string) => handleListApiKeys(mk(t, o), c) },
    { name: "POST /api-keys", run: (t?: string, o?: string) => handleCreateApiKey(mk(t, o, { name: "k" }), c) },
    { name: "DELETE /api-keys/:id", run: (t?: string, o?: string) => handleRevokeApiKey(mk(t, o, undefined, ""), c, "key_x") },
    { name: "GET /members", run: (t?: string, o?: string) => handleListMembers(mk(t, o), c) },
    { name: "POST /members", run: (t?: string, o?: string) => handleAddMember(mk(t, o, { email: "x@y.test", role: "viewer" }), c) },
    { name: "PATCH /members/:id", run: (t?: string, o?: string) => handleUpdateMember(mk(t, o, { role: "admin" }), c, "user_x") },
    { name: "DELETE /members/:id", run: (t?: string, o?: string) => handleRemoveMember(mk(t, o, undefined, ""), c, "user_x") },
    { name: "GET /analytics", run: (t?: string, o?: string) => handleAnalytics(mk(t, o), c) },
    { name: "GET /compare", run: (t?: string, o?: string) => handleCompare(mk(t, o, undefined, `?a=${runId}&b=${runId}`), c) },
    { name: "GET /audit", run: (t?: string, o?: string) => handleListAudit(mk(t, o), c) },
  ];
}

describe("IDOR / authz attack matrix", () => {
  it("every endpoint returns 401 without a session (org header present)", async () => {
    for (const ep of endpoints()) {
      const res = await ep.run(undefined, aOrg);
      expect(res.status, `${ep.name} no-session`).toBe(401);
    }
  });

  it("every endpoint returns 404 for a non-member acting in someone else's org", async () => {
    for (const ep of endpoints()) {
      // user B passes org A's id but is not a member → 404, no enumeration
      const res = await ep.run(bToken, aOrg);
      expect(res.status, `${ep.name} cross-tenant`).toBe(404);
    }
  });

  it("GET /me rejects an unauthenticated caller (401) and never leaks others' orgs", async () => {
    expect((await handleMe(mk(undefined, undefined), c)).status).toBe(401);
    // B only ever sees B's own org, never A's
    const res = await handleMe(mk(bToken, undefined), c);
    const body = (await res.json()) as { orgs: Array<{ id: string }> };
    expect(body.orgs.some((o) => o.id === aOrg)).toBe(false);
  });
});

// Meta-test: fail CI if a new /api/v1 route is added without being covered above.
function findRouteFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...findRouteFiles(p, base));
    else if (entry === "route.ts") out.push(p.slice(base.length + 1));
  }
  return out;
}

describe("route coverage meta-test", () => {
  it("no /api/v1 route escapes the attack matrix", () => {
    const COVERED = new Set([
      "projects/route.ts",
      "projects/[id]/route.ts",
      "test-cases/route.ts",
      "test-cases/[id]/route.ts",
      "runs/route.ts",
      "runs/[id]/route.ts",
      "runs/[id]/queue/route.ts",
      "runs/[id]/signoff/route.ts",
      "runs/[id]/certificate/route.ts",
      "runs/[id]/results/route.ts",
      "runs/[id]/report/route.ts",
      "runs/[id]/coverage/route.ts",
      "members/route.ts",
      "members/[userId]/route.ts",
      "analytics/route.ts",
      "compare/route.ts",
      "audit/route.ts",
      "results/[id]/route.ts",
      "results/[id]/verdicts/route.ts",
      "projects/[id]/calibration/route.ts",
      "projects/[id]/probes/route.ts",
      "webhooks/route.ts",
      "imports/route.ts",
      "api-keys/route.ts",
      "api-keys/[id]/route.ts",
      // `me` is the intentional non-org-scoped bootstrap: it returns ONLY the
      // caller's own memberships (no cross-tenant data), so it has no org probe
      // — but it still must reject an unauthenticated caller (asserted below).
      "me/route.ts",
    ]);
    const found = new Set(findRouteFiles(join(process.cwd(), "src/app/api/v1")));
    expect(
      found,
      "A new /api/v1 route exists. Add it to the attack matrix (and guard it) before merging.",
    ).toEqual(COVERED);
  });
});
