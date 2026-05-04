import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

function getDb() {
  if (_db) return _db;

  const dbPath = process.env.DATABASE_URL || "./data/evaldesk.db";

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");

  _db = drizzle(_sqlite, { schema });

  // Auto-create tables if they don't exist
  initTables(_sqlite);

  return _db;
}

function initTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      email_verified INTEGER,
      image TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      agent_endpoint TEXT,
      agent_api_key TEXT,
      agent_method TEXT DEFAULT 'POST',
      agent_headers TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      input TEXT NOT NULL,
      expected_output TEXT,
      category TEXT,
      tags TEXT,
      "order" INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      total_cases INTEGER NOT NULL DEFAULT 0,
      pass_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      partial_count INTEGER NOT NULL DEFAULT 0,
      unrated_count INTEGER NOT NULL DEFAULT 0,
      pass_rate INTEGER,
      trigger_type TEXT NOT NULL DEFAULT 'manual',
      triggered_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS run_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
      agent_response TEXT,
      response_time INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      human_rating TEXT,
      human_comment TEXT,
      rated_by TEXT REFERENCES users(id),
      rated_at INTEGER,
      judge_rating TEXT,
      judge_score INTEGER,
      judge_reasoning TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS judge_criteria (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      criteria TEXT NOT NULL,
      pass_threshold INTEGER NOT NULL DEFAULT 70,
      model TEXT DEFAULT 'gpt-4o-mini',
      is_default INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS ab_tests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      prompt_a TEXT NOT NULL,
      prompt_b TEXT NOT NULL,
      model_a TEXT DEFAULT 'gpt-4o-mini',
      model_b TEXT DEFAULT 'gpt-4o-mini',
      status TEXT NOT NULL DEFAULT 'pending',
      results_a TEXT,
      results_b TEXT,
      summary TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      pass_rate INTEGER,
      total_cases INTEGER,
      pass_count INTEGER,
      fail_count INTEGER,
      is_public INTEGER DEFAULT 1,
      badge_color TEXT DEFAULT '#ABC83A',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER
    );
  `);
}

// Lazy proxy — DB only created at runtime, not build time
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export { schema };
