// Worker loop. Claims a due job, dispatches by type, then completes it (or
// fails it with backoff for retry/dead-letter). runWorkerOnce is the unit;
// drainWorker processes the backlog (used in tests and the in-process SQLite
// worker); a long-running process calls runWorkerOnce on an interval.
import type { jobsRepo, Job } from "@/db/repos/jobs";

export interface WorkerDeps {
  jobs: ReturnType<typeof jobsRepo>;
  handlers: Record<string, (job: Job) => Promise<void>>;
  now: () => number;
  workerId: string;
  retryBackoffMs?: number;
}

/** Claim and process at most one job. Returns true if a job was handled. */
export async function runWorkerOnce(deps: WorkerDeps): Promise<boolean> {
  const job = await deps.jobs.claim(deps.workerId, deps.now());
  if (!job) return false;

  const handler = deps.handlers[job.type];
  try {
    if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
    await handler(job);
    await deps.jobs.complete(job.id, deps.now());
  } catch (e) {
    await deps.jobs.fail(
      job.id,
      e instanceof Error ? e.message : "job failed",
      deps.now(),
      deps.retryBackoffMs ?? 5000,
    );
  }
  return true;
}

/** Drain the queue until empty (or a safety cap). Returns jobs processed. */
export async function drainWorker(deps: WorkerDeps, max = 1000): Promise<number> {
  let processed = 0;
  while (processed < max && (await runWorkerOnce(deps))) processed++;
  return processed;
}
