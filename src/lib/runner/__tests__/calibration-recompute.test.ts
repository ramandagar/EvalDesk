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
import { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import { recomputeCalibration } from "../calibration-recompute";

const available: Record<string, boolean> = { sqlite: true, postgres: !!process.env.TEST_DATABASE_URL };
const LABELS = ["fail", "partial", "pass"];

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`calibration recompute — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    async function seed(opts: {
      n: number;
      disagreeAt?: number[]; // result indices where human disagrees with judge
      confidence?: number;
      withHuman?: boolean; // seed human ratings (default true)
    }) {
      tdb = await factory();
      const db = tdb!.db;
      const schema = tdb!.schema;
      const orgs = organizationsRepo(db, schema);
      const projects = projectsRepo(db, schema);
      const cases = testCasesRepo(db, schema);
      const runs = runsRepo(db, schema);
      const runResults = runResultsRepo(db, schema);
      const rubrics = rubricsRepo(db, schema);
      const aiScores = aiScoresRepo(db, schema);
      const humanRatings = humanRatingsRepo(db, schema);

      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      const project = await projects.create(org.id, { name: "P", now: 1 });
      const rubric = await rubrics.getOrCreateDefault(org.id, project.id, 1);
      const run = await runs.create(org.id, { projectId: project.id, now: 1 });

      const disagree = new Set(opts.disagreeAt ?? []);
      for (let i = 0; i < opts.n; i++) {
        const tc = await cases.create(org.id, { projectId: project.id, title: `t${i}`, input: "x", now: 1 });
        const rr = await runResults.create(org.id, {
          runId: run.id,
          testCaseId: tc.id,
          status: "completed",
          agentResponse: "a",
          now: 100 + i,
        });
        const judgeOrd = i % 3; // cycle fail/partial/pass
        const humanOrd = disagree.has(i) ? (judgeOrd + 1) % 3 : judgeOrd;
        await aiScores.insertIdempotent(org.id, {
          runResultId: rr.id,
          model: "gpt-4o",
          label: LABELS[judgeOrd],
          scoreNum: judgeOrd * 40 + 10,
          confidence: opts.confidence ?? 0.9,
          rubricVersionId: rubric.id,
          idempotencyKey: `ai:${rr.id}`,
          now: 100 + i,
        });
        if (opts.withHuman ?? true) {
          await humanRatings.submit(org.id, {
            runResultId: rr.id,
            reviewerId: "rev1",
            label: LABELS[humanOrd],
            scoreNum: humanOrd * 40 + 10,
            attemptId: `att:${rr.id}`,
            rubricVersionId: rubric.id,
            now: 100 + i,
          });
        }
      }

      const deps = {
        runs,
        runResults,
        aiScores,
        humanRatings,
        rubrics,
        judgeCalibration: judgeCalibrationRepo(db, schema),
        agreementMetrics: agreementMetricsRepo(db, schema),
        now: () => 9999,
      };
      return { org, project, deps };
    }

    it("publishes τ + κ once enough audit pairs agree (audit-sample drives gating)", async () => {
      // 12 results, judge==human except 1 → 11/12 agreement; auditRate 1 → all are audit pairs.
      const { org, project, deps } = await seed({ n: 12, disagreeAt: [5], confidence: 0.9 });
      const r = await recomputeCalibration(deps, { orgId: org.id, projectId: project.id, auditRate: 1, minAuditN: 5, minKappa: 0.4 });

      expect(r.persisted).toBe(true);
      expect(r.pairs).toBe(12);
      expect(r.published).toBe(true);
      expect(r.tau).toBeCloseTo(0.9, 6); // learned from the audit sample
      expect(r.kappa as number).toBeGreaterThan(0.4);

      const cal = await deps.judgeCalibration.getLatest(org.id, project.id, "ensemble");
      expect(cal!.published).toBe(true);
      expect(cal!.sampleN).toBe(12);
      expect(cal!.auditSampleN).toBe(12);
      expect(typeof cal!.weightedKappa).toBe("number");

      const metric = await deps.agreementMetrics.getLatest(org.id, "project", project.id);
      expect(metric!.nItems).toBe(12);
      expect(metric!.nRaters).toBe(2);
      expect(metric!.kappa as number).toBeGreaterThan(0.4);
      expect(typeof metric!.ciLo).toBe("number"); // bootstrap CI persisted (float parity)
      expect(typeof metric!.ciHi).toBe("number");
      expect(metric!.ciLo as number).toBeLessThanOrEqual(metric!.kappa as number);
    });

    it("stays cold-start (unpublished, τ null) below the audit-sample floor", async () => {
      const { org, project, deps } = await seed({ n: 3 });
      const r = await recomputeCalibration(deps, { orgId: org.id, projectId: project.id, auditRate: 1, minAuditN: 5 });
      expect(r.persisted).toBe(true);
      expect(r.published).toBe(false);
      expect(r.tau).toBeNull();
      const cal = await deps.judgeCalibration.getLatest(org.id, project.id, "ensemble");
      expect(cal!.published).toBe(false);
    });

    it("persists a cold-start row when there are AI scores but no human verdicts yet", async () => {
      const { org, project, deps } = await seed({ n: 4, withHuman: false });
      const r = await recomputeCalibration(deps, { orgId: org.id, projectId: project.id, auditRate: 1 });
      expect(r.persisted).toBe(true);
      expect(r.pairs).toBe(0);
      expect(r.published).toBe(false);
      const cal = await deps.judgeCalibration.getLatest(org.id, project.id, "ensemble");
      expect(cal!.sampleN).toBe(0);
    });

    it("no-ops when the project has no rubric (no judging happened)", async () => {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const org = await orgs.create({ name: "A", slug: "a", now: 1 });
      const project = await projects.create(org.id, { name: "P", now: 1 });
      const deps = {
        runs: runsRepo(tdb!.db, tdb!.schema),
        runResults: runResultsRepo(tdb!.db, tdb!.schema),
        aiScores: aiScoresRepo(tdb!.db, tdb!.schema),
        humanRatings: humanRatingsRepo(tdb!.db, tdb!.schema),
        rubrics: rubricsRepo(tdb!.db, tdb!.schema),
        judgeCalibration: judgeCalibrationRepo(tdb!.db, tdb!.schema),
        agreementMetrics: agreementMetricsRepo(tdb!.db, tdb!.schema),
        now: () => 1,
      };
      const r = await recomputeCalibration(deps, { orgId: org.id, projectId: project.id });
      expect(r.persisted).toBe(false);
      expect(r.reason).toBe("no-rubric");
    });
  });
}
