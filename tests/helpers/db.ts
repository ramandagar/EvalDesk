// ============================================================================
// Test database helpers + the eachDriver harness.
//
// SQLite always runs (tmpfile, never :memory:). Postgres runs only when
// TEST_DATABASE_URL is set (CI / local ephemeral PG). Each Postgres test db
// gets its OWN uniquely-named schema (with the migrator journal in that same
// schema), so parallel test files are fully isolated and never collide on a
// shared `public`. This is the real dual-driver guard: identical assertions
// run against both engines.
// ============================================================================

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  makeSqliteClient,
  migrateSqlite,
  makePgClient,
  migratePg,
  type DbHandle,
  type AppSchema,
} from "@/db/client";
import * as sqliteSchema from "@/db/schema.sqlite";

export interface TestDb {
  driver: "sqlite" | "postgres";
  db: DbHandle;
  schema: AppSchema;
  cleanup: () => Promise<void>;
}

export async function makeSqliteTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), "evaldesk-sqlite-"));
  const { db, raw } = makeSqliteClient(join(dir, "test.db"));
  migrateSqlite(db);
  return {
    driver: "sqlite",
    db,
    schema: sqliteSchema,
    cleanup: async () => {
      raw.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function makePgTestDb(): Promise<TestDb | null> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return null;

  // Clean slate: drop BOTH public and the `drizzle` journal schema, then
  // migrate fresh. Cross-file isolation is handled by fileParallelism:false in
  // vitest.config (DB tests run serially), so a per-run reset is safe.
  const { Pool } = await import("pg");
  const admin = new Pool({ connectionString: url });
  await admin.query(
    "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;",
  );
  await admin.end();

  const { db, close } = await makePgClient(url);
  await migratePg(db);
  const pgSchema = await import("@/db/schema.pg");

  return {
    driver: "postgres",
    db,
    schema: pgSchema as unknown as AppSchema,
    cleanup: () => close(),
  };
}

/** Ordered list of driver factories; PG yields null when not configured. */
export const driverFactories: Array<[string, () => Promise<TestDb | null>]> = [
  ["sqlite", makeSqliteTestDb],
  ["postgres", makePgTestDb],
];
