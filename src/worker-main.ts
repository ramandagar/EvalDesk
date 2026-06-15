// Standalone worker process — the production topology on Postgres at scale: run
// app instances with EVALDESK_DISABLE_WORKER=1 and one or more of these. It
// initializes the DB and runs the same in-process worker loop + reaper, with
// graceful shutdown. Dev/self-host: `npm run worker`.
import { initAppDb } from "./db/runtime";
import { startWorker, stopWorker } from "./lib/worker/start";

async function main() {
  await initAppDb();
  startWorker();
  console.log("[worker-main] standalone worker running");
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.once(sig, () => {
    console.log(`[worker-main] ${sig} — shutting down`);
    stopWorker();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("[worker-main] fatal:", e);
  process.exit(1);
});
