// ============================================================================
// Runtime DB — the production composition root for the database. Selected by
// DB_DRIVER: "postgres" (cloud / scale, the production default) or "sqlite"
// (zero-dependency local / minimal self-host). Initialized ONCE at server boot
// from instrumentation.ts (register()), which can be async (pool creation +
// migration); thereafter getRuntime() returns the cached handle synchronously
// so request handlers stay sync. Migrations run on boot so the schema is always
// current.
// ============================================================================

import {
  makeSqliteClient,
  makePgClient,
  migrateSqlite,
  type DbHandle,
  type AppSchema,
} from "./client";
import * as sqliteSchema from "./schema.sqlite";

export type DbDriver = "postgres" | "sqlite";

interface Runtime {
  driver: DbDriver;
  db: DbHandle;
  schema: AppSchema;
  close: () => Promise<void>;
}

let _runtime: Runtime | null = null;
let _initPromise: Promise<Runtime> | null = null;

export function resolveDriver(): DbDriver {
  return (process.env.DB_DRIVER as DbDriver) || "sqlite";
}

/** Initialize (idempotent) the runtime DB: connect, migrate, cache. */
export async function initAppDb(): Promise<Runtime> {
  if (_runtime) return _runtime;
  if (_initPromise) return _initPromise;

  _initPromise = (async (): Promise<Runtime> => {
    const driver = resolveDriver();
    let runtime: Runtime;
    if (driver === "postgres") {
      const url = process.env.DATABASE_URL;
      if (!url || !/^postgres(ql)?:\/\//.test(url)) {
        throw new Error('DB_DRIVER="postgres" requires DATABASE_URL to be a postgres:// connection string');
      }
      const pg = await makePgClient(url);
      await pg.migrate(); // advisory-locked → multi-instance safe
      const pgSchema = await import("./schema.pg");
      runtime = { driver, db: pg.db, schema: pgSchema as unknown as AppSchema, close: pg.close };
    } else {
      const path = process.env.DATABASE_URL || "./data/evaldesk.db";
      const { db, raw } = makeSqliteClient(path);
      migrateSqlite(db);
      runtime = {
        driver,
        db,
        schema: sqliteSchema,
        close: async () => {
          raw.close();
        },
      };
    }
    _runtime = runtime;
    return runtime;
  })();

  return _initPromise;
}

/** The initialized runtime handle. Throws if initAppDb() has not run yet. */
export function getRuntime(): Runtime {
  if (!_runtime) {
    throw new Error("Database not initialized — initAppDb() must run at startup (see instrumentation.ts)");
  }
  return _runtime;
}

/** Test/teardown hook. */
export async function _resetRuntimeForTest(): Promise<void> {
  if (_runtime) await _runtime.close().catch(() => {});
  _runtime = null;
  _initPromise = null;
}
