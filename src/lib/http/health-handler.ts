// Liveness/readiness probe for load balancers (Railway/Render/Fly/k8s). Pings
// the DB with a cheap round-trip and reports worker liveness. 200 when the DB is
// reachable; 503 when it isn't. Public (no auth, no org) — in the middleware
// allowlist.
import { initAppDb, getRuntime } from "@/db/runtime";
import { rateLimitsRepo } from "@/db/repos/rate-limits";
import { workerLastTick, workerRunning } from "@/lib/worker/start";
import { json } from "./responses";

export async function handleHealth(): Promise<Response> {
  try {
    await initAppDb();
    const { db, schema, driver } = getRuntime();
    // cheap, portable DB round-trip (proves connectivity)
    await rateLimitsRepo(db, schema).currentCount("__health__", 0);

    const workerEnabled = process.env.EVALDESK_DISABLE_WORKER !== "1";
    const lastTick = workerLastTick();
    return json({
      status: "ok",
      db: { driver, reachable: true },
      worker: {
        enabledInThisProcess: workerEnabled,
        running: workerRunning(),
        lastTickAgeMs: lastTick ? Date.now() - lastTick : null,
      },
      time: Date.now(),
    });
  } catch (e) {
    return json({ status: "down", error: e instanceof Error ? e.message : "unknown" }, 503);
  }
}
