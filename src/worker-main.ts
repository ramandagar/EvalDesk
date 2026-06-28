// Standalone worker process — the production topology on Postgres at scale: run
// app instances with EVALDESK_DISABLE_WORKER=1 and one or more of these. It
// initializes the DB and runs the same in-process worker loop + reaper, with
// graceful shutdown. Dev/self-host: `npm run worker`.
import { initAppDb } from "./db/runtime";
import { startWorker, stopWorker } from "./lib/worker/start";
import { logger } from "./lib/logger";

const log = logger.child({ component: "worker-main" });

async function main() {
  await initAppDb();
  startWorker();
  log.info("standalone worker running");
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.once(sig, () => {
    log.info("shutting down", { signal: sig });
    stopWorker();
    process.exit(0);
  });
}

main().catch((e) => {
  log.error("fatal startup error", { err: e });
  process.exit(1);
});
