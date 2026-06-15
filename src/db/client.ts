// ============================================================================
// Driver interface — the ONE place the app chooses Postgres vs SQLite.
//
// The app code and repositories are written against `DbHandle`, a single typed
// surface. The Postgres handle is structurally identical (same Drizzle query
// builder) and is cast to `DbHandle` here, confining all dialect erasure to
// this module (and the repos). No app/route/worker code imports a schema table
// or a raw driver directly.
//
// Timestamps are epoch-millis numbers on BOTH engines, so ordering/compare is
// identical. See scripts/db-spec.mjs for the rules.
// ============================================================================

import Database from "better-sqlite3";
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as runSqliteMigrations } from "drizzle-orm/better-sqlite3/migrator";
import * as sqliteSchema from "./schema.sqlite";

/** Canonical schema shape. The PG schema is structurally identical by codegen. */
export type AppSchema = typeof sqliteSchema;

/** The single typed database surface used by every repository. */
export type DbHandle = BetterSQLite3Database<AppSchema>;

export const SQLITE_MIGRATIONS = "drizzle/sqlite";
export const PG_MIGRATIONS = "drizzle/pg";

// --- SQLite (self-host) -----------------------------------------------------

export function makeSqliteClient(path = ":memory:"): { db: DbHandle; raw: Database.Database } {
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("busy_timeout = 5000");
  const db = drizzleSqlite(raw, { schema: sqliteSchema });
  return { db, raw };
}

export function migrateSqlite(db: DbHandle, folder = SQLITE_MIGRATIONS): void {
  runSqliteMigrations(db, { migrationsFolder: folder });
}

// --- Postgres (cloud / scaled self-host) ------------------------------------
// pg/drizzle node-postgres are imported lazily so the SQLite-only path never
// loads them. The handle is cast to DbHandle (sanctioned erasure boundary).

// A fixed key so concurrent app/worker instances serialize on the SAME Postgres
// advisory lock when migrating at boot (only one migrates; others block then
// no-op). Any stable 64-bit int works.
const MIGRATION_ADVISORY_LOCK = 482073;

export interface PgClient {
  db: DbHandle;
  close: () => Promise<void>;
  /** Run migrations under a Postgres advisory lock (multi-instance safe). */
  migrate: (folder?: string) => Promise<void>;
}

export async function makePgClient(url: string): Promise<PgClient> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pgSchema = await import("./schema.pg");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: pgSchema }) as unknown as DbHandle;

  return {
    db,
    close: () => pool.end(),
    async migrate(folder = PG_MIGRATIONS) {
      // The lock is held on ONE dedicated connection for the whole migration, so
      // a second instance blocks at pg_advisory_lock until the first finishes.
      const lock = await pool.connect();
      try {
        await lock.query("SELECT pg_advisory_lock($1)", [MIGRATION_ADVISORY_LOCK]);
        await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: folder });
      } finally {
        await lock.query("SELECT pg_advisory_unlock($1)", [MIGRATION_ADVISORY_LOCK]).catch(() => {});
        lock.release();
      }
    },
  };
}

/** Plain migration (no advisory lock) — used by tests against an isolated DB. */
export async function migratePg(db: DbHandle, folder = PG_MIGRATIONS): Promise<void> {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: folder });
}

// --- Runtime app handle (driver chosen by env) ------------------------------
// Used by the app/worker. Postgres is wired in Phase 1 when routes migrate off
// the legacy `@/db` proxy; for now SQLite is the supported runtime path.

let _app: DbHandle | null = null;

export function getAppDb(): DbHandle {
  if (_app) return _app;
  const driver = process.env.DB_DRIVER || "sqlite";
  if (driver === "sqlite") {
    const path = process.env.DATABASE_URL || "./data/evaldesk.db";
    const { db } = makeSqliteClient(path);
    _app = db;
    return _app;
  }
  throw new Error(
    `DB_DRIVER="${driver}" runtime wiring lands in Phase 1. Use makePgClient() directly for now.`,
  );
}
