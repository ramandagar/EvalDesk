// Production composition root. Lazily initializes the runtime DB (Postgres in
// production via DB_DRIVER=postgres, SQLite for minimal self-host) on first
// request — connect + migrate — and starts the in-process job worker once, then
// builds the request container. Idempotent and cached, so steady-state requests
// pay nothing. (Instrumentation/edge bundling can't carry the native DB drivers,
// so init happens here in the Node request path.) Tests build a container
// directly against a test DB and never touch this.
import { initAppDb, getRuntime } from "@/db/runtime";
import { loadKeyringFromEnv } from "@/lib/crypto/keyring";
import { buildContainer, type Container } from "./container";

let _ready = false;

async function ensureReady(): Promise<void> {
  if (_ready) return;
  await initAppDb();
  if (process.env.EVALDESK_DISABLE_WORKER !== "1") {
    const { startWorker } = await import("@/lib/worker/start");
    startWorker();
  }
  _ready = true;
}

export async function getRequestContainer(): Promise<Container> {
  await ensureReady();
  const { db, schema } = getRuntime();
  return buildContainer({ db, schema, keyring: loadKeyringFromEnv() });
}
