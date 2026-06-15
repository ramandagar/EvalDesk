// ============================================================================
// Run executor — the core eval loop, run by the worker (never on a request
// thread). Loads a project's test cases, calls the agent for each, stores a
// run_result, and finalizes the run's counts/status. Fully dependency-injected
// (repos + a pre-bound callAgent + clock) so it is testable end-to-end with a
// fake agent and no network.
// ============================================================================

import type { testCasesRepo } from "@/db/repos/test-cases";
import type { runsRepo } from "@/db/repos/runs";
import type { runResultsRepo } from "@/db/repos/run-results";
import type { AgentConfig, AgentCallResult } from "./agent-runner";

export interface ExecutorDeps {
  testCases: ReturnType<typeof testCasesRepo>;
  runs: ReturnType<typeof runsRepo>;
  runResults: ReturnType<typeof runResultsRepo>;
  callAgent: (input: string, config: AgentConfig) => Promise<AgentCallResult>;
  now: () => number;
}

export interface ExecuteRunArgs {
  orgId: string;
  runId: string;
  projectId: string;
  agentConfig: AgentConfig;
}

export interface ExecuteRunSummary {
  runId: string;
  total: number;
  completed: number;
  errors: number;
}

export async function executeRun(deps: ExecutorDeps, args: ExecuteRunArgs): Promise<ExecuteRunSummary> {
  await deps.runs.update(args.orgId, args.runId, { status: "running" });

  const cases = await deps.testCases.listForProject(args.orgId, args.projectId);

  let completed = 0;
  let errors = 0;
  for (const tc of cases) {
    const result = await deps.callAgent(tc.input, args.agentConfig);
    await deps.runResults.create(args.orgId, {
      runId: args.runId,
      testCaseId: tc.id,
      agentResponse: result.response,
      responseTimeMs: result.timeMs,
      status: result.error ? "error" : "completed",
      errorMessage: result.error ?? null,
      // every fresh result starts unrated → needs a human (or judge) verdict
      needsHuman: true,
      now: deps.now(),
    });
    if (result.error) errors++;
    else completed++;
  }

  await deps.runs.update(args.orgId, args.runId, {
    status: "completed",
    totalCases: cases.length,
    unratedCount: cases.length,
    completedAt: deps.now(),
  });

  return { runId: args.runId, total: cases.length, completed, errors };
}
