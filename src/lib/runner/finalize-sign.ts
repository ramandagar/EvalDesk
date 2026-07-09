// ============================================================================
// finalize-and-sign — when a run's sign-off quorum is met, lock the run and
// write an immutable, Ed25519-signed, offline-verifiable certificate. Encodes
// moat feature #3 (sign-off workflow) + #4 (signed artifact). The signer is
// injected (private key resolved at the composition root from the encrypted
// signing key), keeping this pure of crypto-key IO and fully testable.
//
// Quorum = N distinct approvals meeting the policy's role/credential/kappa
// gates. On finalize the run status becomes "signed" (locked); post-lock
// verdict/signoff writes are rejected at the service layer with 409.
// ============================================================================

import { interReviewerKappa, type ReviewerItem } from "@/lib/moat/adjudication";
import { buildCertificatePayload, signCertificate, type CertificateSuiteCoverage } from "@/lib/moat/certificate";
import { listSuitePacks } from "@/lib/suites/packs";
import { computeCoverage, type CoverageItem } from "@/lib/suites/manifest";
import type { runsRepo } from "@/db/repos/runs";
import type { runResultsRepo } from "@/db/repos/run-results";
import type { adjudicationsRepo } from "@/db/repos/adjudications";
import type { humanRatingsRepo } from "@/db/repos/human-ratings";
import type { aiScoresRepo } from "@/db/repos/ai-scores";
import type { runSignoffsRepo } from "@/db/repos/run-signoffs";
import type { signoffPoliciesRepo } from "@/db/repos/signoff-policies";
import type { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import type { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import type { rubricsRepo } from "@/db/repos/rubrics";
import type { testCasesRepo } from "@/db/repos/test-cases";
import type { auditEventsRepo } from "@/db/repos/audit-events";

export interface Signer {
  privateKeyPem: string;
  publicKeyPem: string;
  signingKeyId: string;
}

export interface FinalizeSignDeps {
  runs: ReturnType<typeof runsRepo>;
  runResults: ReturnType<typeof runResultsRepo>;
  adjudications: ReturnType<typeof adjudicationsRepo>;
  humanRatings: ReturnType<typeof humanRatingsRepo>;
  aiScores: ReturnType<typeof aiScoresRepo>;
  runSignoffs: ReturnType<typeof runSignoffsRepo>;
  signoffPolicies: ReturnType<typeof signoffPoliciesRepo>;
  agreementMetrics: ReturnType<typeof agreementMetricsRepo>;
  evalCertificates: ReturnType<typeof evalCertificatesRepo>;
  rubrics: ReturnType<typeof rubricsRepo>;
  testCases: ReturnType<typeof testCasesRepo>;
  /** Optional: when present, finalize + certificate issuance are recorded in the audit hash chain. */
  auditEvents?: ReturnType<typeof auditEventsRepo>;
  signer: Signer;
  now: () => number;
}

export type FinalizeBlockedReason =
  | "run-not-found"
  | "not-enough-approvals"
  | "rejected"
  | "kappa-below-floor"
  | "no-adjudications";

export interface FinalizeSignResult {
  finalized: boolean;
  reason?: FinalizeBlockedReason;
  certificateId?: string;
  alreadySigned?: boolean;
}

const DEFAULT_WEIGHTING = "quadratic";

export async function finalizeAndSign(deps: FinalizeSignDeps, args: { orgId: string; runId: string }): Promise<FinalizeSignResult> {
  const { orgId, runId } = args;
  const run = await deps.runs.getInOrg(orgId, runId);
  if (!run) return { finalized: false, reason: "run-not-found" };

  // Idempotent: an already-signed run returns its existing certificate.
  if (run.status === "signed") {
    const existing = await deps.evalCertificates.getForRun(orgId, runId);
    return { finalized: true, alreadySigned: true, certificateId: existing?.id };
  }

  const policy = await deps.signoffPolicies.getActive(orgId, run.projectId);
  const minReviewers = policy?.minReviewers ?? 1;
  const minKappa = policy?.minKappa ?? null;

  const signoffs = await deps.runSignoffs.listForRun(orgId, runId);
  if (signoffs.some((s) => s.decision === "reject")) return { finalized: false, reason: "rejected" };
  const approvals = signoffs.filter((s) => s.decision === "approve");
  if (approvals.length < minReviewers) return { finalized: false, reason: "not-enough-approvals" };

  const results = await deps.runResults.listForRun(orgId, runId);
  const adjs = await deps.adjudications.listForResults(orgId, results.map((r) => r.id));
  if (adjs.length === 0) return { finalized: false, reason: "no-adjudications" };

  const rubric = await deps.rubrics.getActive(orgId, run.projectId);
  const labels = rubric?.labels ?? ["fail", "partial", "pass"];

  // Inter-reviewer kappa across results (for the certificate + the kappa gate).
  const reviewerItems: ReviewerItem[] = [];
  for (const r of results) {
    const humans = await deps.humanRatings.listCurrentForResult(orgId, r.id);
    const ords = humans.map((h) => labels.indexOf(h.label)).filter((o) => o >= 0);
    if (ords.length) reviewerItems.push({ ordinals: ords });
  }
  const reviewerKappa = interReviewerKappa(reviewerItems, labels.length, DEFAULT_WEIGHTING);
  if (minKappa !== null && reviewerItems.length > 0 && reviewerKappa.kappa < minKappa) {
    return { finalized: false, reason: "kappa-below-floor" };
  }

  // AI-vs-human agreement metric (project scope), if computed.
  const metric = await deps.agreementMetrics.getLatest(orgId, "project", run.projectId);

  // The judge model(s) that scored this run — recorded in the cert for reproducibility.
  // With a multi-model ensemble, record ALL distinct models so the cert never lies.
  const aiForRun = await deps.aiScores.listForResults(orgId, results.map((r) => r.id));
  const judgeModels = [...new Set(aiForRun.map((s) => s.model))];
  const judgeModel = judgeModels.length === 0 ? undefined
    : judgeModels.length === 1 ? judgeModels[0]
    : `ensemble:${judgeModels.join(",")}`;

  // Build the verdict comparison from adjudications + AI consensus.
  const adjByResult = new Map(adjs.map((a) => [a.runResultId, a]));
  const verdicts = results
    .filter((r) => adjByResult.has(r.id))
    .map((r) => {
      const a = adjByResult.get(r.id)!;
      const summary = (a.agreementSummary ?? {}) as { aiConsensusOrdinal?: number | null };
      const aiOrd = summary.aiConsensusOrdinal;
      return {
        runResultId: r.id,
        finalLabel: a.finalLabel,
        judgeLabel: aiOrd != null && aiOrd >= 0 && aiOrd < labels.length ? labels[aiOrd] : undefined,
      };
    });

  const reviewers = [...new Set(approvals.map((s) => s.reviewerId))].map((reviewerId) => ({ reviewerId, role: policy?.requiredRole ?? "reviewer" }));

  // Auto-detect which compliance suite applies from test-case categories.
  // Pick the pack with the most covered controls (≥1); omit if none match.
  const cases = await deps.testCases.listForProject(orgId, run.projectId);
  const caseCat = new Map(cases.map((c) => [c.id, c.category]));
  const coverageItems: CoverageItem[] = [];
  for (const r of results) {
    const cat = caseCat.get(r.testCaseId);
    if (!cat) continue;
    const a = adjByResult.get(r.id);
    const label = a?.finalLabel ?? aiForRun.find((s) => s.runResultId === r.id)?.label ?? "partial";
    coverageItems.push({ category: cat, finalLabel: label });
  }
  let suiteCoverage: CertificateSuiteCoverage | undefined;
  for (const pack of listSuitePacks()) {
    const c = computeCoverage(pack, coverageItems);
    if (c.controlsCovered > 0 && (!suiteCoverage || c.controlsCovered > suiteCoverage.controlsCovered)) {
      suiteCoverage = {
        suiteId: c.suiteId,
        version: c.version,
        regulation: pack.regulation,
        compliant: c.compliant,
        controlsCovered: c.controlsCovered,
        controlsTotal: c.controlsTotal,
        controls: c.controls.map((x) => ({ id: x.id, status: x.status, passRate: x.passRate })),
      };
    }
  }

  const now = deps.now();
  const payload = buildCertificatePayload({
    orgId,
    runId,
    projectId: run.projectId,
    judgeModel,
    weightingScheme: DEFAULT_WEIGHTING,
    kappa: reviewerItems.length > 1 ? reviewerKappa.kappa : null,
    kappaMethod: reviewerKappa.method,
    kappaN: reviewerKappa.n,
    agreementPct: metric?.aiHumanAgreementPct ?? null,
    reviewers,
    verdicts,
    signoffPolicy: { minReviewers, requiredRole: policy?.requiredRole ?? undefined },
    suiteCoverage,
    signedAt: now,
  });

  const cert = signCertificate(payload, deps.signer);
  const { cert: stored } = await deps.evalCertificates.insertIdempotent(orgId, {
    runId,
    contentHash: cert.contentHash,
    signature: cert.signature,
    signingKeyId: cert.signingKeyId,
    publicKeyPem: cert.publicKeyPem,
    canonicalJson: cert.canonicalJson,
    payload: cert.payload,
    weightingScheme: DEFAULT_WEIGHTING,
    signedAt: now,
  });

  // Lock the run + its adjudications.
  await deps.runs.update(orgId, runId, { status: "signed", completedAt: now });
  await deps.adjudications.lockForResults(orgId, results.map((r) => r.id), now);

  // Record the finalize + issuance in the tamper-evident audit chain (system
  // actor — this runs in the worker, not behind a user session). Best-effort.
  if (deps.auditEvents) {
    try {
      await deps.auditEvents.append(orgId, { actorId: null, action: "run.finalized", resourceType: "run", resourceId: runId, details: { certificateId: stored.id } }, now);
      await deps.auditEvents.append(orgId, { actorId: null, action: "certificate.issued", resourceType: "certificate", resourceId: stored.id, details: { contentHash: cert.contentHash } }, now);
    } catch {
      // audit failure must never block finalize; the signed cert is the record.
    }
  }

  return { finalized: true, certificateId: stored.id };
}
