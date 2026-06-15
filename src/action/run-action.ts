// ============================================================================
// GitHub Action core — runs an eval in CI and gates the build. Pure of GitHub
// plumbing: it takes an EvalDesk client + inputs + an IO sink, so it is unit-
// testable with a fake client. The thin entrypoint (action/index.mjs) wires the
// real SDK + GitHub's env-file IO. Exits non-zero when the pass-rate/regression
// gate fails so the workflow step fails.
// ============================================================================

import { assertRunPasses, EvalDeskError, type EvalDesk, type Run } from "@/sdk/typescript";

export interface ActionInputs {
  projectId: string;
  minPassRate?: number; // 0..1
  maxFailures?: number;
}

export interface ActionIO {
  log: (msg: string) => void;
  summary: (markdown: string) => void;
  output: (key: string, value: string) => void;
}

export interface ActionResult {
  exitCode: number;
  run: Run;
  gatePassed: boolean;
  reason?: string;
}

function renderSummary(run: Run, gatePassed: boolean, reason?: string): string {
  const decided = run.passCount + run.failCount + run.partialCount;
  const rate = decided > 0 ? ((run.passCount / decided) * 100).toFixed(1) : "—";
  const badge = gatePassed ? "✅ PASS" : "❌ FAIL";
  return [
    `## EvalDesk — ${badge}`,
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Status | ${run.status} |`,
    `| Pass rate | ${rate}% |`,
    `| Pass / Fail / Partial | ${run.passCount} / ${run.failCount} / ${run.partialCount} |`,
    `| Needs human | ${run.unratedCount} |`,
    `| Total cases | ${run.totalCases} |`,
    ...(reason ? ["", `> ${reason}`] : []),
    "",
  ].join("\n");
}

export async function runAction(client: EvalDesk, inputs: ActionInputs, io: ActionIO): Promise<ActionResult> {
  io.log(`Starting EvalDesk run for project ${inputs.projectId}…`);
  const handle = await client.runs.create(inputs.projectId);
  io.log(`Run ${handle.id} queued; waiting for completion…`);
  const run = await handle.wait();
  io.log(`Run ${handle.id} finished: ${run.status}`);

  let gatePassed = true;
  let reason: string | undefined;
  try {
    assertRunPasses(run, { minPassRate: inputs.minPassRate, maxFailures: inputs.maxFailures });
  } catch (e) {
    gatePassed = false;
    reason = e instanceof EvalDeskError ? e.message : (e as Error).message;
  }

  const decided = run.passCount + run.failCount + run.partialCount;
  io.output("run_id", run.id);
  io.output("status", run.status);
  io.output("pass_rate", decided > 0 ? (run.passCount / decided).toFixed(4) : "0");
  io.output("gate_passed", String(gatePassed));
  io.summary(renderSummary(run, gatePassed, reason));

  return { exitCode: gatePassed ? 0 : 1, run, gatePassed, reason };
}
