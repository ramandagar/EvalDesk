// Worker composition root: assembles the job handlers + queue from a DbHandle.
import type { DbHandle, AppSchema } from "@/db/client";
import type { Keyring } from "@/lib/crypto/secrets";
import { projectsRepo } from "@/db/repos/projects";
import { secretsRepo } from "@/db/repos/secrets";
import { testCasesRepo } from "@/db/repos/test-cases";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { humanRatingsRepo } from "@/db/repos/human-ratings";
import { rubricsRepo } from "@/db/repos/rubrics";
import { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import { adjudicationsRepo } from "@/db/repos/adjudications";
import { runSignoffsRepo } from "@/db/repos/run-signoffs";
import { signoffPoliciesRepo } from "@/db/repos/signoff-policies";
import { signingKeysRepo } from "@/db/repos/signing-keys";
import { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import { webhooksRepo } from "@/db/repos/webhooks";
import { webhookDeliveriesRepo } from "@/db/repos/webhook-deliveries";
import { jobsRepo } from "@/db/repos/jobs";
import { auditEventsRepo } from "@/db/repos/audit-events";
import {
  handleRunExecute,
  handleRunJudge,
  handleCalibrationRecompute,
  handleRunFinalize,
  handleWebhookDeliver,
  handleAdversarialGenerate,
  type JobHandlerDeps,
  type JudgeConfig,
} from "./handlers";
import type { WorkerDeps } from "./worker";

export interface WorkerContextDeps {
  db: DbHandle;
  schema: AppSchema;
  keyring: Keyring;
  fetchImpl: typeof fetch;
  now?: () => number;
  workerId?: string;
  /** When provided, the AI judge runs after each execution (run.execute →
   *  run.judge). When omitted, judging is disabled (human-only review). */
  judge?: JudgeConfig;
  /** DNS resolver for the webhook SSRF guard (injectable for tests). */
  resolve?: (hostname: string) => Promise<string[]>;
}

export function buildWorkerContext(deps: WorkerContextDeps): WorkerDeps {
  const now = deps.now ?? (() => Date.now());
  const resolve =
    deps.resolve ??
    (async (hostname: string) => {
      const dns = await import("node:dns/promises");
      const records = await dns.lookup(hostname, { all: true });
      return records.map((r) => r.address);
    });
  const handlerDeps: JobHandlerDeps = {
    projects: projectsRepo(deps.db, deps.schema),
    secrets: secretsRepo(deps.db, deps.schema),
    testCases: testCasesRepo(deps.db, deps.schema),
    runs: runsRepo(deps.db, deps.schema),
    runResults: runResultsRepo(deps.db, deps.schema),
    aiScores: aiScoresRepo(deps.db, deps.schema),
    humanRatings: humanRatingsRepo(deps.db, deps.schema),
    rubrics: rubricsRepo(deps.db, deps.schema),
    judgeCalibration: judgeCalibrationRepo(deps.db, deps.schema),
    agreementMetrics: agreementMetricsRepo(deps.db, deps.schema),
    adjudications: adjudicationsRepo(deps.db, deps.schema),
    runSignoffs: runSignoffsRepo(deps.db, deps.schema),
    signoffPolicies: signoffPoliciesRepo(deps.db, deps.schema),
    signingKeys: signingKeysRepo(deps.db, deps.schema),
    evalCertificates: evalCertificatesRepo(deps.db, deps.schema),
    webhooks: webhooksRepo(deps.db, deps.schema),
    webhookDeliveries: webhookDeliveriesRepo(deps.db, deps.schema),
    jobs: jobsRepo(deps.db, deps.schema),
    auditEvents: auditEventsRepo(deps.db, deps.schema),
    keyring: deps.keyring,
    fetchImpl: deps.fetchImpl,
    resolve,
    now,
    judge: deps.judge,
  };

  const handlers: WorkerDeps["handlers"] = {
    "run.execute": (job) => handleRunExecute(handlerDeps, job),
    "calibration.recompute": (job) => handleCalibrationRecompute(handlerDeps, job),
    "run.finalize": (job) => handleRunFinalize(handlerDeps, job),
    "webhook.deliver": (job) => handleWebhookDeliver(handlerDeps, job),
    "adversarial.generate": (job) => handleAdversarialGenerate(handlerDeps, job),
  };
  if (deps.judge) handlers["run.judge"] = (job) => handleRunJudge(handlerDeps, job);

  return {
    jobs: jobsRepo(deps.db, deps.schema),
    handlers,
    now,
    workerId: deps.workerId ?? "worker-1",
  };
}
