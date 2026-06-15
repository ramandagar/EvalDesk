import { describe, it, expect, afterEach } from "vitest";
import { driverFactories, type TestDb } from "../../../tests/helpers/db";
import { organizationsRepo } from "../repos/organizations";
import { projectsRepo } from "../repos/projects";
import { testCasesRepo } from "../repos/test-cases";
import { runsRepo } from "../repos/runs";
import { runResultsRepo } from "../repos/run-results";
import { rubricsRepo, DEFAULT_RUBRIC_LABELS } from "../repos/rubrics";
import { aiScoresRepo } from "../repos/ai-scores";
import { humanRatingsRepo } from "../repos/human-ratings";

const available: Record<string, boolean> = {
  sqlite: true,
  postgres: !!process.env.TEST_DATABASE_URL,
};

for (const [driver, factory] of driverFactories) {
  describe.skipIf(!available[driver])(`wedge repos (rubrics + ai_scores) — ${driver}`, () => {
    let tdb: TestDb | null = null;
    afterEach(async () => {
      await tdb?.cleanup();
      tdb = null;
    });

    async function fixture() {
      tdb = await factory();
      const orgs = organizationsRepo(tdb!.db, tdb!.schema);
      const projects = projectsRepo(tdb!.db, tdb!.schema);
      const cases = testCasesRepo(tdb!.db, tdb!.schema);
      const runs = runsRepo(tdb!.db, tdb!.schema);
      const runResults = runResultsRepo(tdb!.db, tdb!.schema);
      const orgA = await orgs.create({ name: "A", slug: "a", now: 1 });
      const orgB = await orgs.create({ name: "B", slug: "b", now: 1 });
      const p = await projects.create(orgA.id, { name: "P", now: 1 });
      const tc = await cases.create(orgA.id, { projectId: p.id, title: "t", input: "i", now: 1 });
      const run = await runs.create(orgA.id, { projectId: p.id, now: 1 });
      const rr = await runResults.create(orgA.id, { runId: run.id, testCaseId: tc.id, now: 1, status: "completed" });
      return { orgA, orgB, p, rr };
    }

    it("rubrics: default is created once with the shared ordinal label scale", async () => {
      const { orgA, p } = await fixture();
      const rubrics = rubricsRepo(tdb!.db, tdb!.schema);

      const r1 = await rubrics.getOrCreateDefault(orgA.id, p.id, 100);
      expect(r1.labels).toEqual([...DEFAULT_RUBRIC_LABELS]);
      expect(r1.kind).toBe("ordinal");
      expect(r1.version).toBe(1);
      expect(r1.alwaysHuman).toBe(false);

      // second call returns the SAME row, does not create a duplicate
      const r2 = await rubrics.getOrCreateDefault(orgA.id, p.id, 200);
      expect(r2.id).toBe(r1.id);
      expect((await rubrics.getActive(orgA.id, p.id))?.id).toBe(r1.id);
    });

    it("rubrics: a new version supersedes as the active rubric", async () => {
      const { orgA, p } = await fixture();
      const rubrics = rubricsRepo(tdb!.db, tdb!.schema);
      await rubrics.create(orgA.id, { projectId: p.id, now: 1, version: 1 });
      await rubrics.create(orgA.id, { projectId: p.id, now: 2, version: 2, labels: ["bad", "ok", "good"] });
      const active = await rubrics.getActive(orgA.id, p.id);
      expect(active?.version).toBe(2);
      expect(active?.labels).toEqual(["bad", "ok", "good"]);
    });

    it("ai_scores: insert is idempotent on idempotency_key (no double-count)", async () => {
      const { orgA, rr } = await fixture();
      const scores = aiScoresRepo(tdb!.db, tdb!.schema);

      const key = "result1:specA:group1";
      const first = await scores.insertIdempotent(orgA.id, {
        runResultId: rr.id,
        model: "gpt-4o",
        label: "pass",
        scoreNum: 90,
        confidence: 0.8,
        idempotencyKey: key,
        now: 10,
      });
      expect(first.inserted).toBe(true);

      // replay with the SAME key is a no-op and returns the original row
      const replay = await scores.insertIdempotent(orgA.id, {
        runResultId: rr.id,
        model: "gpt-4o",
        label: "fail", // different payload — must be ignored
        scoreNum: 5,
        idempotencyKey: key,
        now: 20,
      });
      expect(replay.inserted).toBe(false);
      expect(replay.score.id).toBe(first.score.id);
      expect(replay.score.label).toBe("pass"); // original preserved, NOT overwritten
      expect(replay.score.scoreNum).toBe(90);

      // exactly one row exists for the result
      const all = await scores.listForResult(orgA.id, rr.id);
      expect(all).toHaveLength(1);
    });

    it("ai_scores: many distinct scores per result (ensemble × samples)", async () => {
      const { orgA, rr } = await fixture();
      const scores = aiScoresRepo(tdb!.db, tdb!.schema);
      await scores.insertIdempotent(orgA.id, { runResultId: rr.id, model: "gpt-4o", label: "pass", idempotencyKey: "k1", now: 1 });
      await scores.insertIdempotent(orgA.id, { runResultId: rr.id, model: "claude", label: "partial", idempotencyKey: "k2", now: 2 });
      const all = await scores.listForResult(orgA.id, rr.id);
      expect(all.map((s) => s.model).sort()).toEqual(["claude", "gpt-4o"]);
    });

    it("ai_scores: cross-org reads return nothing", async () => {
      const { orgA, orgB, rr } = await fixture();
      const scores = aiScoresRepo(tdb!.db, tdb!.schema);
      await scores.insertIdempotent(orgA.id, { runResultId: rr.id, model: "gpt-4o", label: "pass", idempotencyKey: "k1", now: 1 });
      expect(await scores.listForResult(orgB.id, rr.id)).toHaveLength(0);
    });

    it("human_ratings: submit is idempotent on (result, reviewer, attempt)", async () => {
      const { orgA, rr } = await fixture();
      const human = humanRatingsRepo(tdb!.db, tdb!.schema);
      const first = await human.submit(orgA.id, { runResultId: rr.id, reviewerId: "rev1", label: "pass", attemptId: "a1", now: 1 });
      expect(first.inserted).toBe(true);
      // a retried POST with the same attempt is a no-op (cannot corrupt kappa)
      const retry = await human.submit(orgA.id, { runResultId: rr.id, reviewerId: "rev1", label: "fail", attemptId: "a1", now: 2 });
      expect(retry.inserted).toBe(false);
      expect(retry.rating.id).toBe(first.rating.id);
      expect(retry.rating.label).toBe("pass"); // original preserved
      expect(await human.listCurrentForResult(orgA.id, rr.id)).toHaveLength(1);
    });

    it("human_ratings: each reviewer gets one current row; cross-org isolated", async () => {
      const { orgA, orgB, rr } = await fixture();
      const human = humanRatingsRepo(tdb!.db, tdb!.schema);
      await human.submit(orgA.id, { runResultId: rr.id, reviewerId: "rev1", label: "pass", attemptId: "a1", now: 1 });
      await human.submit(orgA.id, { runResultId: rr.id, reviewerId: "rev2", label: "partial", attemptId: "a1", now: 1 });
      const current = await human.listCurrentForResult(orgA.id, rr.id);
      expect(current.map((r) => r.reviewerId).sort()).toEqual(["rev1", "rev2"]);
      expect(await human.listCurrentForResults(orgB.id, [rr.id])).toHaveLength(0);
    });
  });
}
