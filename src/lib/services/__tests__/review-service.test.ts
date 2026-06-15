import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { apiKeysRepo } from "@/db/repos/api-keys";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { testCasesRepo } from "@/db/repos/test-cases";
import { projectsRepo } from "@/db/repos/projects";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { humanRatingsRepo } from "@/db/repos/human-ratings";
import { adjudicationsRepo } from "@/db/repos/adjudications";
import { runSignoffsRepo } from "@/db/repos/run-signoffs";
import { rubricsRepo } from "@/db/repos/rubrics";
import { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { guard } from "@/lib/auth/guard";
import { reviewService } from "@/lib/services/review-service";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const now = () => 100;
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
  const runs = runsRepo(tdb.db, tdb.schema);
  const runResults = runResultsRepo(tdb.db, tdb.schema);
  const testCases = testCasesRepo(tdb.db, tdb.schema);
  const aiScores = aiScoresRepo(tdb.db, tdb.schema);
  const humanRatings = humanRatingsRepo(tdb.db, tdb.schema);
  const rubrics = rubricsRepo(tdb.db, tdb.schema);

  const svc = reviewService({
    guard: guard({ sessions, memberships: membershipsRepo(tdb.db, tdb.schema), users: usersRepo(tdb.db, tdb.schema), apiKeys: apiKeysRepo(tdb.db, tdb.schema), now: () => 1 }),
    runs,
    runResults,
    testCases,
    aiScores,
    humanRatings,
    adjudications: adjudicationsRepo(tdb.db, tdb.schema),
    runSignoffs: runSignoffsRepo(tdb.db, tdb.schema),
    rubrics,
    evalCertificates: evalCertificatesRepo(tdb.db, tdb.schema),
    judgeCalibration: judgeCalibrationRepo(tdb.db, tdb.schema),
    agreementMetrics: agreementMetricsRepo(tdb.db, tdb.schema),
    now,
  });

  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const project = await projects.create(a.org.id, { name: "P", now: 100 });
  const rubric = await rubrics.getOrCreateDefault(a.org.id, project.id, 100);
  const run = await runs.create(a.org.id, { projectId: project.id, status: "completed", now: 100 });
  const tc = await testCases.create(a.org.id, { projectId: project.id, title: "t", input: "is this safe?", expectedOutput: "no", now: 100 });
  const rr = await runResults.create(a.org.id, { runId: run.id, testCaseId: tc.id, status: "completed", agentResponse: "yes it is safe", needsHuman: true, now: 100 });
  // an AI score (judge said pass, low confidence) + a peer reviewer's verdict
  await aiScores.insertIdempotent(a.org.id, { runResultId: rr.id, model: "gpt-4o", label: "pass", scoreNum: 80, confidence: 0.4, disagreement: 0.5, rubricVersionId: rubric.id, idempotencyKey: "ai1", now: 100 });
  await humanRatings.submit(a.org.id, { runResultId: rr.id, reviewerId: "peer-reviewer", label: "fail", attemptId: "peer1", now: 100 });

  return { svc, a, runs, run, rr };
}

describe("reviewService — blind payload contract (server-enforced)", () => {
  it("BLIND: the serialized item contains NO AI-judge or peer verdict fields", async () => {
    const { svc, a, rr } = await setup();
    const item = await svc.getItem(a.token, a.org.id, rr.id, { blind: true });

    // the reviewer DOES see the question + the agent answer
    expect(item.agentResponse).toBe("yes it is safe");
    expect(item.input).toBe("is this safe?");
    expect(item.blind).toBe(true);

    // ...but the bytes carry no judge/peer leakage at all (absent keys, provable)
    const json = JSON.stringify(item);
    expect("aiScores" in item).toBe(false);
    expect("peerRatings" in item).toBe(false);
    expect("needsHumanReasons" in item).toBe(false);
    expect(json).not.toContain("gpt-4o");
    expect(json).not.toContain("peer-reviewer");
    expect(json).not.toContain("judge-disagreement");
  });

  it("NON-BLIND: the item includes AI scores, peer verdicts, and the queue reason", async () => {
    const { svc, a, rr } = await setup();
    const item = await svc.getItem(a.token, a.org.id, rr.id, { blind: false });
    expect(item.aiScores).toEqual([{ model: "gpt-4o", label: "pass", score: 80, confidence: 0.4 }]);
    expect(item.peerRatings).toEqual([{ reviewerId: "peer-reviewer", label: "fail" }]);
    expect(item.needsHumanReasons).toEqual(expect.arrayContaining(["judge-disagreement", "low-confidence"]));
  });

  it("queue lists only results that still need a human", async () => {
    const { svc, a, run } = await setup();
    const q = await svc.queue(a.token, a.org.id, run.id, { blind: true });
    expect(q).toHaveLength(1);
    expect(q[0].blind).toBe(true);
  });
});

describe("reviewService — verdict submission", () => {
  it("submits idempotently (same attempt → no second write) and adjudicates", async () => {
    const { svc, a, rr } = await setup();
    const first = await svc.submitVerdict(a.token, a.org.id, rr.id, { label: "fail", attemptId: "att1", rationale: "wrong" });
    expect(first.inserted).toBe(true);
    expect(first.finalLabel).toBe("fail"); // single human verdict wins

    const retry = await svc.submitVerdict(a.token, a.org.id, rr.id, { label: "pass", attemptId: "att1" });
    expect(retry.inserted).toBe(false); // idempotent — the retry did not overwrite
  });

  it("rejects a label not in the rubric (400)", async () => {
    const { svc, a, rr } = await setup();
    await expect(svc.submitVerdict(a.token, a.org.id, rr.id, { label: "excellent", attemptId: "x" })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects verdicts on a LOCKED (signed) run with 409", async () => {
    const { svc, a, runs, run, rr } = await setup();
    await runs.update(a.org.id, run.id, { status: "signed" }); // simulate finalize
    await expect(svc.submitVerdict(a.token, a.org.id, rr.id, { label: "fail", attemptId: "y" })).rejects.toMatchObject({ status: 409 });
  });

  it("rejects sign-off on a locked run with 409", async () => {
    const { svc, a, runs, run } = await setup();
    await runs.update(a.org.id, run.id, { status: "signed" });
    await expect(svc.submitSignoff(a.token, a.org.id, run.id, { decision: "approve" })).rejects.toMatchObject({ status: 409 });
  });

  it("denies an unauthenticated caller (401)", async () => {
    const { svc, a, rr } = await setup();
    await expect(svc.submitVerdict(undefined, a.org.id, rr.id, { label: "fail", attemptId: "z" })).rejects.toMatchObject({ status: 401 });
  });
});
