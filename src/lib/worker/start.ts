// ============================================================================
// Worker runtime entrypoint. Started once from instrumentation.ts after the DB
// is initialized. Builds the worker context from the runtime DB + keyring,
// wires an SSRF-guarded fetch for agent/webhook calls and a DNS resolver, and
// drains the job queue on an interval (in-process — fine for single-node
// self-host and for SQLite; on Postgres you can also run this as a separate
// `node` process for true multi-worker concurrency). Idempotent: safe to call
// more than once.
// ============================================================================

import { buildWorkerContext } from "./context";
import { drainWorker } from "./worker";
import { getRuntime } from "@/db/runtime";
import { loadKeyringFromEnv } from "@/lib/crypto/keyring";
import { guardedFetch, type SafeFetchDeps } from "@/lib/net/ssrf";
import { resolveProvider, isProviderName } from "@/lib/provider-factory";
import { logger } from "@/lib/logger";
import type { JudgeConfig } from "./handlers";

const log = logger.child({ component: "worker" });

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let reaperTimer: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;

/** Last time the worker drained — exposed for the /health endpoint. */
export function workerLastTick(): number {
  return lastTickAt;
}
export function workerRunning(): boolean {
  return started;
}

async function dnsResolve(hostname: string): Promise<string[]> {
  const dns = await import("node:dns/promises");
  const records = await dns.lookup(hostname, { all: true });
  return records.map((r) => r.address);
}

/** Build the AI judge from env (BYO key). Disabled (human-only) when no key. */
function buildJudgeFromEnv(): JudgeConfig | undefined {
  const providerName = process.env.JUDGE_PROVIDER || "deepseek";
  const model = process.env.JUDGE_MODEL || undefined;
  if (!isProviderName(providerName)) return undefined;
  try {
    const provider = resolveProvider({ name: providerName, env: process.env });
    const spec = model ? { model } : { model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini" };
    const auditRate = process.env.JUDGE_AUDIT_RATE ? Number(process.env.JUDGE_AUDIT_RATE) : 0.05;
    return { provider, specs: [spec], auditRate, allowSingleJudgeAutoFinalize: false };
  } catch {
    // no key configured → judging disabled, results route to human review
    return undefined;
  }
}

export function startWorker(): void {
  if (started) return;
  started = true;

  const { db, schema } = getRuntime();
  const keyring = loadKeyringFromEnv();

  // SSRF-guarded fetch: validate + IP-pin every outbound agent/webhook call.
  const safeFetchDeps: SafeFetchDeps = { resolve: dnsResolve, fetchImpl: fetch };
  const guardedFetchImpl = ((url: string, init?: RequestInit) => guardedFetch(safeFetchDeps, url, init)) as unknown as typeof fetch;

  const judge = buildJudgeFromEnv();
  const ctx = buildWorkerContext({
    db,
    schema,
    keyring,
    fetchImpl: guardedFetchImpl,
    resolve: dnsResolve,
    judge,
  });

  const intervalMs = process.env.WORKER_INTERVAL_MS ? Number(process.env.WORKER_INTERVAL_MS) : 2000;
  const tick = () => {
    lastTickAt = Date.now();
    drainWorker(ctx).catch((e) => log.error("drain error", { err: e instanceof Error ? e : String(e) }));
  };
  timer = setInterval(tick, intervalMs);
  tick();

  // Crash recovery: periodically reclaim jobs orphaned by a crashed worker.
  const staleMs = process.env.WORKER_STALE_MS ? Number(process.env.WORKER_STALE_MS) : 60_000;
  const reapMs = process.env.WORKER_REAP_MS ? Number(process.env.WORKER_REAP_MS) : 15_000;
  reaperTimer = setInterval(() => {
    ctx.jobs
      .reapStale(Date.now(), staleMs)
      .then((n) => n > 0 && log.info("reaped stale jobs", { count: n }))
      .catch((e) => log.error("reap error", { err: e instanceof Error ? e : String(e) }));
  }, reapMs);

  // Graceful shutdown: stop the timers on SIGTERM/SIGINT so a deploy doesn't
  // leave timers dangling; any job interrupted mid-flight is recovered by the
  // reaper on the next worker.
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.once(sig, () => stopWorker());
  }

  log.info("started", { intervalMs, reapMs, staleMs, judge: judge ? "enabled" : "disabled-human-only" });
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  if (reaperTimer) clearInterval(reaperTimer);
  timer = null;
  reaperTimer = null;
  started = false;
}
