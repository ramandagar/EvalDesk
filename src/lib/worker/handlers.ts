// Job handlers (composition). run.execute resolves the project's agent config —
// decrypting the API key from the secrets table — binds the SSRF-guarded fetch,
// and runs the executor. Pure of env; deps (repos, keyring, fetchImpl, clock)
// are injected so the worker is testable with a fake agent and no network.
import { decryptSecret, type Keyring } from "@/lib/crypto/secrets";
import { executeRun } from "@/lib/runner/run-executor";
import { judgeRun } from "@/lib/runner/run-judge";
import { recomputeCalibration } from "@/lib/runner/calibration-recompute";
import { finalizeAndSign } from "@/lib/runner/finalize-sign";
import { resolveOrCreateSigner } from "@/lib/crypto/signer-bootstrap";
import { dispatchEvent, deliverWebhook, type DeliverPayload } from "@/lib/webhooks/dispatch";
import { callAgent, type AgentType } from "@/lib/runner/agent-runner";
import type { SafeFetchDeps } from "@/lib/net/ssrf";
import type { Provider } from "@/lib/ai/provider";
import type { JudgeSpec } from "@/lib/ai/judge-ensemble";
import type { projectsRepo } from "@/db/repos/projects";
import type { secretsRepo } from "@/db/repos/secrets";
import type { testCasesRepo } from "@/db/repos/test-cases";
import type { runsRepo } from "@/db/repos/runs";
import type { runResultsRepo } from "@/db/repos/run-results";
import type { aiScoresRepo } from "@/db/repos/ai-scores";
import type { humanRatingsRepo } from "@/db/repos/human-ratings";
import type { rubricsRepo } from "@/db/repos/rubrics";
import type { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import type { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import type { adjudicationsRepo } from "@/db/repos/adjudications";
import type { runSignoffsRepo } from "@/db/repos/run-signoffs";
import type { signoffPoliciesRepo } from "@/db/repos/signoff-policies";
import type { signingKeysRepo } from "@/db/repos/signing-keys";
import type { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import type { webhooksRepo } from "@/db/repos/webhooks";
import type { webhookDeliveriesRepo } from "@/db/repos/webhook-deliveries";
import type { jobsRepo, Job } from "@/db/repos/jobs";
import type { auditEventsRepo } from "@/db/repos/audit-events";

/** Optional AI-judging configuration. When absent, judging is disabled
 *  (human-only review): run.execute does not enqueue run.judge. */
export interface JudgeConfig {
  provider: Provider;
  specs: JudgeSpec[];
  auditRate?: number;
  allowSingleJudgeAutoFinalize?: boolean;
}

export interface JobHandlerDeps {
  projects: ReturnType<typeof projectsRepo>;
  secrets: ReturnType<typeof secretsRepo>;
  testCases: ReturnType<typeof testCasesRepo>;
  runs: ReturnType<typeof runsRepo>;
  runResults: ReturnType<typeof runResultsRepo>;
  aiScores: ReturnType<typeof aiScoresRepo>;
  humanRatings: ReturnType<typeof humanRatingsRepo>;
  rubrics: ReturnType<typeof rubricsRepo>;
  judgeCalibration: ReturnType<typeof judgeCalibrationRepo>;
  agreementMetrics: ReturnType<typeof agreementMetricsRepo>;
  adjudications: ReturnType<typeof adjudicationsRepo>;
  runSignoffs: ReturnType<typeof runSignoffsRepo>;
  signoffPolicies: ReturnType<typeof signoffPoliciesRepo>;
  signingKeys: ReturnType<typeof signingKeysRepo>;
  evalCertificates: ReturnType<typeof evalCertificatesRepo>;
  webhooks: ReturnType<typeof webhooksRepo>;
  webhookDeliveries: ReturnType<typeof webhookDeliveriesRepo>;
  jobs: ReturnType<typeof jobsRepo>;
  /** Optional: when present, run finalize + certificate issuance are audited. */
  auditEvents?: ReturnType<typeof auditEventsRepo>;
  keyring: Keyring;
  fetchImpl: typeof fetch;
  /** DNS resolver for the SSRF guard on webhook delivery (injectable for tests). */
  resolve: (hostname: string) => Promise<string[]>;
  now: () => number;
  judge?: JudgeConfig;
}

export async function handleRunExecute(deps: JobHandlerDeps, job: Job): Promise<void> {
  const orgId = job.orgId;
  const { runId, projectId } = job.payload as { runId: string; projectId: string };

  const project = await deps.projects.getInOrg(orgId, projectId);
  if (!project || !project.agentEndpoint) {
    await deps.runs.update(orgId, runId, { status: "failed" });
    return;
  }

  let apiKey: string | undefined;
  const blob = await deps.secrets.get(orgId, "project", projectId, "agent_api_key");
  if (blob) {
    apiKey = decryptSecret(blob, deps.keyring, `org:${orgId}:project:${projectId}:agent_api_key`);
  }

  const agentConfig = {
    endpoint: project.agentEndpoint,
    type: (project.agentType ?? "custom") as AgentType,
    apiKey,
    model: project.defaultModel,
    method: project.agentMethod,
    headers: (project.agentHeaders as Record<string, string> | null) ?? undefined,
  };

  await executeRun(
    {
      testCases: deps.testCases,
      runs: deps.runs,
      runResults: deps.runResults,
      callAgent: (input, config) => callAgent({ fetchImpl: deps.fetchImpl, now: deps.now }, input, config),
      now: deps.now,
    },
    { orgId, runId, projectId, agentConfig },
  );

  // Hand off to the AI judge when judging is configured; otherwise the run is
  // left for human-only review (results already have needs_human = true).
  if (deps.judge) {
    await deps.jobs.enqueue({ orgId, type: "run.judge", payload: { runId, projectId }, now: deps.now() });
  }
}

export async function handleRunJudge(deps: JobHandlerDeps, job: Job): Promise<void> {
  if (!deps.judge) throw new Error("run.judge received but no judge is configured");
  const orgId = job.orgId;
  const { runId, projectId } = job.payload as { runId: string; projectId: string };

  await judgeRun(
    {
      provider: deps.judge.provider,
      testCases: deps.testCases,
      runs: deps.runs,
      runResults: deps.runResults,
      aiScores: deps.aiScores,
      rubrics: deps.rubrics,
      now: deps.now,
    },
    {
      orgId,
      runId,
      projectId,
      specs: deps.judge.specs,
      auditRate: deps.judge.auditRate,
      allowSingleJudgeAutoFinalize: deps.judge.allowSingleJudgeAutoFinalize,
    },
  );

  // Recompute the AI-vs-human calibration now that fresh AI scores exist
  // (cold-start until enough human audit pairs accumulate).
  await deps.jobs.enqueue({ orgId, type: "calibration.recompute", payload: { projectId }, now: deps.now() });

  // Notify subscribers that the run finished judging.
  const run = await deps.runs.getInOrg(orgId, runId);
  await dispatchEvent(
    { webhooks: deps.webhooks, deliveries: deps.webhookDeliveries, jobs: deps.jobs, now: deps.now },
    orgId,
    run?.status === "failed" ? "run.failed" : "run.completed",
    { runId, projectId, passCount: run?.passCount, failCount: run?.failCount, needsHumanCount: run?.unratedCount },
  );
}

export async function handleCalibrationRecompute(deps: JobHandlerDeps, job: Job): Promise<void> {
  const orgId = job.orgId;
  const { projectId } = job.payload as { projectId: string };
  await recomputeCalibration(
    {
      runs: deps.runs,
      runResults: deps.runResults,
      aiScores: deps.aiScores,
      humanRatings: deps.humanRatings,
      rubrics: deps.rubrics,
      judgeCalibration: deps.judgeCalibration,
      agreementMetrics: deps.agreementMetrics,
      now: deps.now,
    },
    { orgId, projectId, auditRate: deps.judge?.auditRate },
  );
}

/** Finalize + sign a run once its sign-off quorum is met. Idempotent: re-runs are
 *  no-ops on an already-signed run. The signer (org Ed25519 key) is resolved /
 *  lazily created here from signing_keys + the encrypted secret. */
export async function handleRunFinalize(deps: JobHandlerDeps, job: Job): Promise<void> {
  const orgId = job.orgId;
  const { runId } = job.payload as { runId: string };
  const signer = await resolveOrCreateSigner(
    { signingKeys: deps.signingKeys, secrets: deps.secrets, keyring: deps.keyring, now: deps.now },
    orgId,
  );
  const result = await finalizeAndSign(
    {
      runs: deps.runs,
      runResults: deps.runResults,
      adjudications: deps.adjudications,
      humanRatings: deps.humanRatings,
      aiScores: deps.aiScores,
      runSignoffs: deps.runSignoffs,
      signoffPolicies: deps.signoffPolicies,
      agreementMetrics: deps.agreementMetrics,
      evalCertificates: deps.evalCertificates,
      rubrics: deps.rubrics,
      auditEvents: deps.auditEvents,
      signer,
      now: deps.now,
    },
    { orgId, runId },
  );

  // On a fresh finalize, fan a certificate.signed event out to subscribed webhooks.
  if (result.finalized && !result.alreadySigned) {
    await dispatchEvent(
      { webhooks: deps.webhooks, deliveries: deps.webhookDeliveries, jobs: deps.jobs, now: deps.now },
      orgId,
      "certificate.signed",
      { runId, certificateId: result.certificateId },
    );
  }
}

export async function handleWebhookDeliver(deps: JobHandlerDeps, job: Job): Promise<void> {
  const p = job.payload as DeliverPayload;
  await deliverWebhook(
    {
      webhooks: deps.webhooks,
      deliveries: deps.webhookDeliveries,
      keyring: deps.keyring,
      fetch: { resolve: deps.resolve, fetchImpl: deps.fetchImpl } as SafeFetchDeps,
      now: deps.now,
    },
    job.orgId,
    p,
  );
}
