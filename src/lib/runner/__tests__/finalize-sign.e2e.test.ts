import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../../tests/helpers/db";
import { organizationsRepo } from "@/db/repos/organizations";
import { projectsRepo } from "@/db/repos/projects";
import { testCasesRepo } from "@/db/repos/test-cases";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { rubricsRepo } from "@/db/repos/rubrics";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { humanRatingsRepo } from "@/db/repos/human-ratings";
import { adjudicationsRepo } from "@/db/repos/adjudications";
import { signoffPoliciesRepo } from "@/db/repos/signoff-policies";
import { runSignoffsRepo } from "@/db/repos/run-signoffs";
import { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import { reviewSettled } from "../review-settled";
import { finalizeAndSign, type Signer } from "../finalize-sign";
import { generateSigningKeyPair } from "@/lib/crypto/signing";
import { verifyCertificate, type SignedCertificate } from "@/lib/moat/certificate";

const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };

/** Reconstruct the offline-verifiable bundle from a persisted certificate row. */
function bundleFromRow(row: {
  payload: unknown;
  canonicalJson: string | null;
  contentHash: string;
  signature: string;
  signingKeyId: string;
  publicKeyPem: string;
}): SignedCertificate {
  return {
    payload: row.payload as Record<string, unknown>,
    canonicalJson: row.canonicalJson as string,
    contentHash: row.contentHash,
    signature: row.signature,
    signingKeyId: row.signingKeyId,
    publicKeyPem: row.publicKeyPem,
    algo: "ed25519",
  };
}

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`finalize-and-sign e2e — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    async function setup(opts: { minReviewers?: number; reviewers?: string[] } = {}) {
      tdb = await factory();
      const db = tdb!.db;
      const schema = tdb!.schema;
      const r = {
        orgs: organizationsRepo(db, schema),
        projects: projectsRepo(db, schema),
        cases: testCasesRepo(db, schema),
        runs: runsRepo(db, schema),
        runResults: runResultsRepo(db, schema),
        rubrics: rubricsRepo(db, schema),
        aiScores: aiScoresRepo(db, schema),
        humanRatings: humanRatingsRepo(db, schema),
        adjudications: adjudicationsRepo(db, schema),
        signoffPolicies: signoffPoliciesRepo(db, schema),
        runSignoffs: runSignoffsRepo(db, schema),
        agreementMetrics: agreementMetricsRepo(db, schema),
        evalCertificates: evalCertificatesRepo(db, schema),
      };
      const org = await r.orgs.create({ name: "A", slug: "a", now: 1 });
      const project = await r.projects.create(org.id, { name: "P", now: 1 });
      const rubric = await r.rubrics.getOrCreateDefault(org.id, project.id, 1);
      const run = await r.runs.create(org.id, { projectId: project.id, status: "completed", now: 1 });
      await r.signoffPolicies.create(org.id, { projectId: project.id, minReviewers: opts.minReviewers ?? 2, now: 1 });

      const reviewers = opts.reviewers ?? ["rev1", "rev2"];
      const resultIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const tc = await r.cases.create(org.id, { projectId: project.id, title: `t${i}`, input: "x", now: 1 });
        const rr = await r.runResults.create(org.id, { runId: run.id, testCaseId: tc.id, status: "completed", agentResponse: "a", needsHuman: true, now: 1 });
        resultIds.push(rr.id);
        // AI judged it "pass"
        await r.aiScores.insertIdempotent(org.id, { runResultId: rr.id, model: "gpt-4o", label: "pass", scoreNum: 90, confidence: 0.8, rubricVersionId: rubric.id, idempotencyKey: `ai:${rr.id}`, now: 1 });
        // reviewers also rate "pass"
        for (const rev of reviewers) {
          await r.humanRatings.submit(org.id, { runResultId: rr.id, reviewerId: rev, label: "pass", scoreNum: 88, attemptId: `att:${rr.id}:${rev}`, rubricVersionId: rubric.id, now: 1 });
        }
      }

      const deps = {
        runs: r.runs,
        runResults: r.runResults,
        aiScores: r.aiScores,
        humanRatings: r.humanRatings,
        adjudications: r.adjudications,
        rubrics: r.rubrics,
        now: () => 5000,
      };
      // settle each result (as review.settled would on each verdict)
      for (const id of resultIds) await reviewSettled(deps, { orgId: org.id, runResultId: id });

      const kp = generateSigningKeyPair();
      const signer: Signer = { privateKeyPem: kp.privateKeyPem, publicKeyPem: kp.publicKeyPem, signingKeyId: "sk1" };
      const finalizeDeps = {
        ...r,
        rubrics: r.rubrics,
        signer,
        now: () => 6000,
      };
      return { org, project, run, resultIds, r, signer, finalizeDeps };
    }

    it("settles verdicts into adjudications + run counters", async () => {
      const { org, run, resultIds, r } = await setup();
      const adjs = await r.adjudications.listForResults(org.id, resultIds);
      expect(adjs).toHaveLength(3);
      expect(adjs.every((a) => a.finalLabel === "pass")).toBe(true);
      expect(adjs.every((a) => a.method === "human-consensus")).toBe(true);
      const finalized = await r.runs.getInOrg(org.id, run.id);
      expect(finalized!.passCount).toBe(3);
      expect(finalized!.unratedCount).toBe(0);
      expect(finalized!.passRate).toBe(100);
      // results no longer need human review
      const results = await r.runResults.listForRun(org.id, run.id);
      expect(results.every((rr) => rr.needsHuman === false)).toBe(true);
    });

    it("blocks finalize until the approval quorum is met", async () => {
      const { org, run, r, finalizeDeps } = await setup({ minReviewers: 2 });
      // only one approval so far
      await r.runSignoffs.submit(org.id, { runId: run.id, reviewerId: "rev1", decision: "approve", now: 1 });
      const blocked = await finalizeAndSign(finalizeDeps, { orgId: org.id, runId: run.id });
      expect(blocked.finalized).toBe(false);
      expect(blocked.reason).toBe("not-enough-approvals");
      expect(await r.evalCertificates.getForRun(org.id, run.id)).toBeNull();
    });

    it("finalizes on quorum → signs a certificate that verifies OFFLINE", async () => {
      const { org, run, r, finalizeDeps } = await setup({ minReviewers: 2 });
      await r.runSignoffs.submit(org.id, { runId: run.id, reviewerId: "rev1", decision: "approve", now: 1 });
      await r.runSignoffs.submit(org.id, { runId: run.id, reviewerId: "rev2", decision: "approve", now: 2 });

      const res = await finalizeAndSign(finalizeDeps, { orgId: org.id, runId: run.id });
      expect(res.finalized).toBe(true);
      expect(res.certificateId).toBeTruthy();

      // run is locked
      expect((await r.runs.getInOrg(org.id, run.id))!.status).toBe("signed");

      // the PERSISTED certificate verifies offline with only the bundled key
      const row = await r.evalCertificates.getForRun(org.id, run.id);
      const v = verifyCertificate(bundleFromRow(row!));
      expect(v.valid).toBe(true);
      expect(v.reasons).toEqual([]);

      // tamper with the stored payload → verification fails
      const tampered = bundleFromRow(row!);
      (tampered.payload as Record<string, unknown>).runId = "run_hacked";
      expect(verifyCertificate(tampered).valid).toBe(false);
    });

    it("a rejection blocks signing", async () => {
      const { org, run, r, finalizeDeps } = await setup({ minReviewers: 1 });
      await r.runSignoffs.submit(org.id, { runId: run.id, reviewerId: "rev1", decision: "reject", note: "unsafe", now: 1 });
      const res = await finalizeAndSign(finalizeDeps, { orgId: org.id, runId: run.id });
      expect(res.finalized).toBe(false);
      expect(res.reason).toBe("rejected");
    });

    it("finalize is idempotent — a second call returns the same certificate, no re-sign", async () => {
      const { org, run, r, finalizeDeps } = await setup({ minReviewers: 1 });
      await r.runSignoffs.submit(org.id, { runId: run.id, reviewerId: "rev1", decision: "approve", now: 1 });
      const first = await finalizeAndSign(finalizeDeps, { orgId: org.id, runId: run.id });
      const second = await finalizeAndSign(finalizeDeps, { orgId: org.id, runId: run.id });
      expect(second.alreadySigned).toBe(true);
      expect(second.certificateId).toBe(first.certificateId);
    });
  });
}
