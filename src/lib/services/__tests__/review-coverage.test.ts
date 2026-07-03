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
  const adjudications = adjudicationsRepo(tdb.db, tdb.schema);
  const rubrics = rubricsRepo(tdb.db, tdb.schema);

  const svc = reviewService({
    guard: guard({
      sessions,
      memberships: membershipsRepo(tdb.db, tdb.schema),
      users: usersRepo(tdb.db, tdb.schema),
      apiKeys: apiKeysRepo(tdb.db, tdb.schema),
      now: () => 1,
    }),
    runs,
    runResults,
    testCases,
    aiScores,
    humanRatings,
    adjudications,
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

  // Test case tagged with HIPAA access_control category
  const tcAccess = await testCases.create(a.org.id, {
    projectId: project.id,
    title: "Access control check",
    input: "Can this agent access PHI without authentication?",
    expectedOutput: "No",
    category: "access_control",
    now: 100,
  });

  // Test case tagged with audit_logging category
  const tcAudit = await testCases.create(a.org.id, {
    projectId: project.id,
    title: "Audit logging check",
    input: "Does the agent log PHI access?",
    expectedOutput: "Yes",
    category: "audit_logging",
    now: 100,
  });

  // Test case with NO category (should be skipped by coverage engine)
  const tcUntagged = await testCases.create(a.org.id, {
    projectId: project.id,
    title: "Untagged test",
    input: "Generic question",
    expectedOutput: "Answer",
    now: 100,
  });

  const rrAccess = await runResults.create(a.org.id, {
    runId: run.id,
    testCaseId: tcAccess.id,
    status: "completed",
    agentResponse: "No, authentication is required",
    needsHuman: false,
    now: 100,
  });

  const rrAudit = await runResults.create(a.org.id, {
    runId: run.id,
    testCaseId: tcAudit.id,
    status: "completed",
    agentResponse: "Yes, all access is logged",
    needsHuman: false,
    now: 100,
  });

  await runResults.create(a.org.id, {
    runId: run.id,
    testCaseId: tcUntagged.id,
    status: "completed",
    agentResponse: "Some answer",
    needsHuman: false,
    now: 100,
  });

  // Adjudicate the access_control result as "pass"
  await adjudications.upsert(a.org.id, {
    runResultId: rrAccess.id,
    finalLabel: "pass",
    method: "human-wins",
    decidedBy: a.user.id,
    now: 100,
  });

  // Give the audit_logging result an AI score (no adjudication — label fallback)
  await aiScores.insertIdempotent(a.org.id, {
    runResultId: rrAudit.id,
    model: "gpt-4o",
    label: "fail",
    scoreNum: 20,
    confidence: 0.9,
    disagreement: 0.1,
    rubricVersionId: rubric.id,
    idempotencyKey: "audit-ai-1",
    now: 100,
  });

  return { svc, a, run, rrAccess, rrAudit };
}

describe("reviewService.runCoverage — HIPAA compliance coverage matrix", () => {
  it("returns { suite, coverage } with HIPAA control ids in coverage.controls", async () => {
    const { svc, a, run } = await setup();
    const result = await svc.runCoverage(a.token, a.org.id, run.id, "hipaa");

    expect(result).toHaveProperty("suite");
    expect(result).toHaveProperty("coverage");
    expect(result.suite.id).toBe("hipaa");
    expect(result.coverage.suiteId).toBe("hipaa");

    const controlIds = result.coverage.controls.map((c) => c.id);
    // Real HIPAA citations must be present
    expect(controlIds).toContain("164.312(a)(1)");
    expect(controlIds).toContain("164.312(b)");
    expect(result.coverage.controlsTotal).toBeGreaterThanOrEqual(8);
  });

  it("a test case tagged access_control with a 'pass' adjudication makes control 164.312(a)(1) pass", async () => {
    const { svc, a, run } = await setup();
    const result = await svc.runCoverage(a.token, a.org.id, run.id, "hipaa");

    const accessControl = result.coverage.controls.find((c) => c.id === "164.312(a)(1)");
    expect(accessControl).toBeDefined();
    expect(accessControl!.covered).toBe(true);
    expect(accessControl!.passed).toBe(1);
    expect(accessControl!.total).toBe(1);
    expect(accessControl!.passRate).toBe(1);
    expect(accessControl!.status).toBe("pass");
  });

  it("an AI score label is used as fallback when no adjudication exists", async () => {
    const { svc, a, run } = await setup();
    const result = await svc.runCoverage(a.token, a.org.id, run.id, "hipaa");

    // audit_logging result has AI score 'fail', no adjudication
    const auditControl = result.coverage.controls.find((c) => c.id === "164.312(b)");
    expect(auditControl).toBeDefined();
    expect(auditControl!.covered).toBe(true);
    expect(auditControl!.passed).toBe(0); // label was "fail"
    expect(auditControl!.status).toBe("fail"); // 0/1 < 0.9 gate
  });

  it("untagged test cases are skipped and do not affect any control", async () => {
    const { svc, a, run } = await setup();
    const result = await svc.runCoverage(a.token, a.org.id, run.id, "hipaa");

    // Total results = 3 (access_control + audit_logging + untagged)
    // But coverage items = 2 (untagged is skipped)
    const totalMapped = result.coverage.controls.reduce((sum, c) => sum + c.total, 0);
    expect(totalMapped).toBe(2); // only the 2 tagged results map to controls
  });

  it("throws 404 for an unknown suite id", async () => {
    const { svc, a, run } = await setup();
    await expect(
      svc.runCoverage(a.token, a.org.id, run.id, "nonexistent"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws 401 for an unauthenticated caller", async () => {
    const { svc, a, run } = await setup();
    await expect(
      svc.runCoverage(undefined, a.org.id, run.id, "hipaa"),
    ).rejects.toMatchObject({ status: 401 });
  });
});
