// ============================================================================
// Review service — the guarded surface the review workspace + SDK call. Every
// method authorizes via the guard first and scopes to the caller's org.
//
// Blind review is SERVER-ENFORCED, not DOM-hidden: when a queue is blind, the
// AI-judge verdict and ALL peer verdict rows are omitted from the serialized
// payload entirely — never sent, so `blindMode:true` is a true statement about
// the bytes the reviewer saw (a DOM test cannot prove absence; a contract test
// on this serializer can). Verdict submission is idempotent (attempt_id) and
// rejected with 409 once the run is locked (signed).
// ============================================================================

import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import { reviewSettled, type ReviewSettledDeps } from "@/lib/runner/review-settled";
import type { runsRepo } from "@/db/repos/runs";
import type { runResultsRepo } from "@/db/repos/run-results";
import type { testCasesRepo } from "@/db/repos/test-cases";
import type { aiScoresRepo } from "@/db/repos/ai-scores";
import type { humanRatingsRepo } from "@/db/repos/human-ratings";
import type { adjudicationsRepo } from "@/db/repos/adjudications";
import type { runSignoffsRepo } from "@/db/repos/run-signoffs";
import type { rubricsRepo } from "@/db/repos/rubrics";
import type { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import type { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import type { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import type { jobsRepo } from "@/db/repos/jobs";

export interface ReviewServiceDeps {
  guard: ReturnType<typeof guard>;
  runs: ReturnType<typeof runsRepo>;
  runResults: ReturnType<typeof runResultsRepo>;
  testCases: ReturnType<typeof testCasesRepo>;
  aiScores: ReturnType<typeof aiScoresRepo>;
  humanRatings: ReturnType<typeof humanRatingsRepo>;
  adjudications: ReturnType<typeof adjudicationsRepo>;
  runSignoffs: ReturnType<typeof runSignoffsRepo>;
  rubrics: ReturnType<typeof rubricsRepo>;
  evalCertificates: ReturnType<typeof evalCertificatesRepo>;
  judgeCalibration: ReturnType<typeof judgeCalibrationRepo>;
  agreementMetrics: ReturnType<typeof agreementMetricsRepo>;
  /** Optional: when present, an approval enqueues a run.finalize job (async sign). */
  jobs?: ReturnType<typeof jobsRepo>;
  now: () => number;
}

export interface ReviewItem {
  resultId: string;
  runId: string;
  testCaseId: string;
  input: string;
  expectedOutput: string | null;
  agentResponse: string | null;
  needsHuman: boolean;
  blind: boolean;
  myRating: { label: string; rationale: string | null } | null;
  // NON-BLIND ONLY (absent keys, not null, when blind):
  needsHumanReasons?: string[];
  aiScores?: Array<{ model: string; label: string; score: number | null; confidence: number | null }>;
  peerRatings?: Array<{ reviewerId: string | null; label: string }>;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    (m.get(k) ?? m.set(k, []).get(k)!).push(it);
  }
  return m;
}

export function reviewService(deps: ReviewServiceDeps) {
  const settledDeps: ReviewSettledDeps = {
    runs: deps.runs,
    runResults: deps.runResults,
    aiScores: deps.aiScores,
    humanRatings: deps.humanRatings,
    adjudications: deps.adjudications,
    rubrics: deps.rubrics,
    now: deps.now,
  };

  async function serializeItem(orgId: string, result: Awaited<ReturnType<typeof deps.runResults.getInOrg>>, opts: { blind: boolean; reviewerId: string }): Promise<ReviewItem> {
    const r = result!;
    const tc = await deps.testCases.getInOrg(orgId, r.testCaseId);
    const myRatings = (await deps.humanRatings.listCurrentForResult(orgId, r.id)).filter((h) => h.reviewerId === opts.reviewerId);
    const item: ReviewItem = {
      resultId: r.id,
      runId: r.runId,
      testCaseId: r.testCaseId,
      input: tc?.input ?? "",
      expectedOutput: tc?.expectedOutput ?? null,
      agentResponse: r.agentResponse,
      needsHuman: r.needsHuman,
      blind: opts.blind,
      myRating: myRatings[0] ? { label: myRatings[0].label, rationale: myRatings[0].rationale } : null,
    };
    if (!opts.blind) {
      const ai = await deps.aiScores.listForResult(orgId, r.id);
      const peers = (await deps.humanRatings.listCurrentForResult(orgId, r.id)).filter((h) => h.reviewerId !== opts.reviewerId);
      const reasons: string[] = [];
      const confs = ai.map((s) => s.confidence).filter((c): c is number => c != null);
      const disagreements = ai.map((s) => s.disagreement).filter((d): d is number => d != null);
      if (disagreements.some((d) => d > 0)) reasons.push("judge-disagreement");
      if (confs.length && mean(confs) < 0.6) reasons.push("low-confidence");
      item.needsHumanReasons = reasons;
      item.aiScores = ai.map((s) => ({ model: s.model, label: s.label, score: s.scoreNum, confidence: s.confidence }));
      item.peerRatings = peers.map((p) => ({ reviewerId: p.reviewerId, label: p.label }));
    }
    return item;
  }

  async function assertUnlocked(orgId: string, runId: string) {
    const run = await deps.runs.getInOrg(orgId, runId);
    if (!run) throw new AuthzError(404, "Not found");
    if (run.status === "signed") throw new AuthzError(409, "Run is locked");
    return run;
  }

  return {
    /** Queue of results still needing a human verdict for a run. */
    async queue(token: string | undefined, orgId: string, runId: string, opts: { blind?: boolean } = {}): Promise<ReviewItem[]> {
      const ctx = await deps.guard.requireMember(token, orgId, "run:read");
      const run = await deps.runs.getInOrg(orgId, runId);
      if (!run) throw new AuthzError(404, "Not found");
      const results = await deps.runResults.listForRun(orgId, runId);
      const blind = opts.blind ?? false;
      const out: ReviewItem[] = [];
      for (const r of results) {
        if (!r.needsHuman) continue;
        out.push(await serializeItem(orgId, r, { blind, reviewerId: ctx.user.id }));
      }
      return out;
    },

    async getItem(token: string | undefined, orgId: string, resultId: string, opts: { blind?: boolean } = {}): Promise<ReviewItem> {
      const ctx = await deps.guard.requireMember(token, orgId, "run:read");
      const result = await deps.runResults.getInOrg(orgId, resultId);
      if (!result) throw new AuthzError(404, "Not found");
      return serializeItem(orgId, result, { blind: opts.blind ?? false, reviewerId: ctx.user.id });
    },

    /** Submit (or correct) a verdict. Idempotent on attempt_id; 409 if the run is locked. */
    async submitVerdict(
      token: string | undefined,
      orgId: string,
      resultId: string,
      args: { label: string; attemptId: string; rationale?: string | null; scoreNum?: number | null; confidence?: number | null },
    ): Promise<{ finalLabel: string | null; method: string; inserted: boolean }> {
      const ctx = await deps.guard.requireMember(token, orgId, "result:rate");
      const result = await deps.runResults.getInOrg(orgId, resultId);
      if (!result) throw new AuthzError(404, "Not found");
      await assertUnlocked(orgId, result.runId);

      const rubric = await deps.rubrics.getActive(orgId, (await deps.runs.getInOrg(orgId, result.runId))!.projectId);
      if (rubric && !rubric.labels.includes(args.label)) throw new AuthzError(400, "Label not in rubric");

      const { inserted } = await deps.humanRatings.submit(orgId, {
        runResultId: resultId,
        reviewerId: ctx.user.id,
        label: args.label,
        rationale: args.rationale ?? null,
        scoreNum: args.scoreNum ?? null,
        confidence: args.confidence ?? null,
        attemptId: args.attemptId,
        rubricVersionId: rubric?.id ?? null,
        now: deps.now(),
      });

      const settled = await reviewSettled(settledDeps, { orgId, runResultId: resultId });
      return { ...settled, inserted };
    },

    /** Approve or reject a run for sign-off. 409 if already locked. */
    async submitSignoff(
      token: string | undefined,
      orgId: string,
      runId: string,
      args: { decision: "approve" | "reject"; note?: string | null },
    ): Promise<{ decision: string }> {
      const ctx = await deps.guard.requireMember(token, orgId, "run:approve");
      await assertUnlocked(orgId, runId);
      const so = await deps.runSignoffs.submit(orgId, { runId, reviewerId: ctx.user.id, decision: args.decision, note: args.note ?? null, now: deps.now() });
      // An approval may complete the quorum → enqueue an (idempotent) finalize-and-sign.
      if (args.decision === "approve" && deps.jobs) {
        await deps.jobs.enqueue({ orgId, type: "run.finalize", payload: { runId }, now: deps.now() });
      }
      return { decision: so.decision };
    },

    /** Fetch a run's signed certificate (the offline-verifiable bundle), or null. */
    async getCertificate(token: string | undefined, orgId: string, runId: string) {
      await deps.guard.requireMember(token, orgId, "run:read");
      const cert = await deps.evalCertificates.getForRun(orgId, runId);
      if (!cert) return null;
      return {
        id: cert.id,
        runId: cert.runId,
        payload: cert.payload,
        canonicalJson: cert.canonicalJson,
        contentHash: cert.contentHash,
        signature: cert.signature,
        signingKeyId: cert.signingKeyId,
        publicKeyPem: cert.publicKeyPem,
        algo: cert.algo,
        signedAt: cert.signedAt,
      };
    },

    /** Full per-result report for a run: agent answer + AI scores + human verdicts + final label. */
    async runReport(token: string | undefined, orgId: string, runId: string) {
      await deps.guard.requireMember(token, orgId, "run:read");
      const run = await deps.runs.getInOrg(orgId, runId);
      if (!run) throw new AuthzError(404, "Not found");

      const results = await deps.runResults.listForRun(orgId, runId);
      const ids = results.map((r) => r.id);
      const cases = await deps.testCases.listForProject(orgId, run.projectId);
      const caseById = new Map(cases.map((c) => [c.id, c]));
      const ai = await deps.aiScores.listForResults(orgId, ids);
      const humans = await deps.humanRatings.listCurrentForResults(orgId, ids);
      const adjs = await deps.adjudications.listForResults(orgId, ids);
      const aiBy = groupBy(ai, (s) => s.runResultId);
      const humanBy = groupBy(humans, (h) => h.runResultId);
      const adjBy = new Map(adjs.map((a) => [a.runResultId, a]));

      const items = results.map((r) => {
        const tc = caseById.get(r.testCaseId);
        return {
          resultId: r.id,
          title: tc?.title ?? "",
          input: tc?.input ?? "",
          expectedOutput: tc?.expectedOutput ?? null,
          agentResponse: r.agentResponse,
          status: r.status,
          needsHuman: r.needsHuman,
          aiScores: (aiBy.get(r.id) ?? []).map((s) => ({ model: s.model, label: s.label, score: s.scoreNum, confidence: s.confidence, disagreement: s.disagreement })),
          humanRatings: (humanBy.get(r.id) ?? []).map((h) => ({ reviewerId: h.reviewerId, label: h.label, rationale: h.rationale })),
          finalLabel: adjBy.get(r.id)?.finalLabel ?? null,
        };
      });
      return { run, results: items };
    },

    /** Compare two runs case-by-case (final verdict, with AI label as fallback). */
    async compareRuns(token: string | undefined, orgId: string, runIdA: string, runIdB: string) {
      await deps.guard.requireMember(token, orgId, "run:read");
      const [runA, runB] = await Promise.all([deps.runs.getInOrg(orgId, runIdA), deps.runs.getInOrg(orgId, runIdB)]);
      if (!runA || !runB) throw new AuthzError(404, "Not found");

      const labelMap = async (runId: string, projectId: string) => {
        const results = await deps.runResults.listForRun(orgId, runId);
        const ids = results.map((r) => r.id);
        const adjs = await deps.adjudications.listForResults(orgId, ids);
        const ai = await deps.aiScores.listForResults(orgId, ids);
        const adjBy = new Map(adjs.map((a) => [a.runResultId, a.finalLabel]));
        const aiBy = groupBy(ai, (s) => s.runResultId);
        const cases = await deps.testCases.listForProject(orgId, projectId);
        const titleBy = new Map(cases.map((c) => [c.id, c.title]));
        const out = new Map<string, { title: string; label: string | null }>();
        for (const r of results) {
          const fallback = aiBy.get(r.id)?.[0]?.label ?? null;
          out.set(r.testCaseId, { title: titleBy.get(r.testCaseId) ?? "", label: adjBy.get(r.id) ?? fallback });
        }
        return out;
      };

      const [a, b] = await Promise.all([labelMap(runIdA, runA.projectId), labelMap(runIdB, runB.projectId)]);
      const allCaseIds = new Set([...a.keys(), ...b.keys()]);
      const rows = [...allCaseIds].map((id) => {
        const aa = a.get(id);
        const bb = b.get(id);
        return { title: aa?.title ?? bb?.title ?? "", aLabel: aa?.label ?? null, bLabel: bb?.label ?? null, changed: (aa?.label ?? null) !== (bb?.label ?? null) };
      });
      return {
        a: { id: runA.id, passRate: runA.passRate, passCount: runA.passCount, failCount: runA.failCount, partialCount: runA.partialCount },
        b: { id: runB.id, passRate: runB.passRate, passCount: runB.passCount, failCount: runB.failCount, partialCount: runB.partialCount },
        delta: { passRate: (runB.passRate ?? 0) - (runA.passRate ?? 0) },
        rows,
        changedCount: rows.filter((r) => r.changed).length,
      };
    },

    /** The project's latest AI-vs-human calibration + inter-rater agreement (for the panels). */
    async getCalibration(token: string | undefined, orgId: string, projectId: string, judgeModel = "ensemble") {
      await deps.guard.requireMember(token, orgId, "run:read");
      const calibration = await deps.judgeCalibration.getLatest(orgId, projectId, judgeModel);
      const agreement = await deps.agreementMetrics.getLatest(orgId, "project", projectId);
      return { calibration, agreement };
    },
  };
}
