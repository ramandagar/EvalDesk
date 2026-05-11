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

function safeAlter(sqlite: Database.Database, sql: string) {
  try {
    sqlite.exec(sql);
  } catch {
    // Column already exists — ignore
  }
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
      role TEXT DEFAULT 'owner',
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
      slack_webhook_url TEXT,
      slack_channel TEXT,
      slack_notify_on TEXT,
      default_judge_id TEXT,
      default_model TEXT DEFAULT 'gpt-4o-mini',
      cost_per_1k_input REAL,
      cost_per_1k_output REAL,
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
      conversation_id TEXT,
      difficulty TEXT DEFAULT 'medium',
      is_adversarial INTEGER DEFAULT 0,
      adversarial_type TEXT,
      source TEXT,
      golden_set INTEGER DEFAULT 0,
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
      scheduled_run_id TEXT,
      model_used TEXT,
      total_input_tokens INTEGER,
      total_output_tokens INTEGER,
      total_cost REAL,
      pass_threshold INTEGER,
      is_gated INTEGER DEFAULT 0,
      approved_by TEXT REFERENCES users(id),
      approved_at INTEGER,
      approval_status TEXT,
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
      conversation_id TEXT,
      streaming_chunks TEXT,
      tool_calls_json TEXT,
      tokens_input INTEGER,
      tokens_output INTEGER,
      cost REAL,
      judge_criteria_id TEXT,
      consensus_rating TEXT,
      consensus_score INTEGER,
      safety_flagged INTEGER DEFAULT 0,
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

    -- Stream 2: Multi-turn conversations
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tool_calls_log (
      id TEXT PRIMARY KEY,
      run_result_id TEXT NOT NULL REFERENCES run_results(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      arguments TEXT,
      result TEXT,
      expected_result TEXT,
      is_valid INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Stream 3: Judge enhancements
    CREATE TABLE IF NOT EXISTS multi_judge_results (
      id TEXT PRIMARY KEY,
      run_result_id TEXT NOT NULL REFERENCES run_results(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      rating TEXT NOT NULL,
      score INTEGER NOT NULL,
      reasoning TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS judge_templates (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      criteria TEXT NOT NULL,
      pass_threshold INTEGER NOT NULL DEFAULT 70,
      is_official INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS safety_scores (
      id TEXT PRIMARY KEY,
      run_result_id TEXT NOT NULL REFERENCES run_results(id) ON DELETE CASCADE,
      toxicity_score REAL NOT NULL DEFAULT 0,
      hallucination_score REAL NOT NULL DEFAULT 0,
      bias_score REAL NOT NULL DEFAULT 0,
      overall_safety REAL NOT NULL DEFAULT 1.0,
      flagged_issues TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS citation_checks (
      id TEXT PRIMARY KEY,
      run_result_id TEXT NOT NULL REFERENCES run_results(id) ON DELETE CASCADE,
      citation_text TEXT NOT NULL,
      source_url TEXT,
      is_verified INTEGER,
      verification_status TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Stream 5: Integrations
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT,
      is_active INTEGER DEFAULT 1,
      last_triggered INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      payload TEXT,
      status_code INTEGER,
      response_body TEXT,
      success INTEGER,
      attempts INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS scheduled_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      cron_expression TEXT NOT NULL,
      run_name_template TEXT,
      is_active INTEGER DEFAULT 1,
      last_run_at INTEGER,
      next_run_at INTEGER,
      created_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Stream 6: Collaboration
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      run_result_id TEXT REFERENCES run_results(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS annotation_queues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_result_id TEXT NOT NULL REFERENCES run_results(id) ON DELETE CASCADE,
      assigned_to TEXT REFERENCES users(id),
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      due_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      permissions TEXT DEFAULT '["read"]',
      last_used_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      project_id TEXT REFERENCES projects(id),
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Billing & Marketing
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      interval TEXT DEFAULT 'month',
      features TEXT,
      limits TEXT,
      stripe_price_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      current_period_start INTEGER,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      excerpt TEXT,
      author TEXT NOT NULL,
      cover_image TEXT,
      published_at INTEGER,
      tags TEXT,
      is_published INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription_id TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'usd',
      status TEXT NOT NULL DEFAULT 'draft',
      stripe_invoice_id TEXT,
      pdf_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS onboarding_state (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      current_step INTEGER NOT NULL DEFAULT 1,
      completed_steps TEXT,
      role TEXT,
      use_case TEXT,
      agent_type TEXT,
      is_complete INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Add new columns to existing tables (safe — ignores if column already exists)
  safeAlter(sqlite, `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'owner'`);
  safeAlter(sqlite, `ALTER TABLE projects ADD COLUMN slack_webhook_url TEXT`);
  safeAlter(sqlite, `ALTER TABLE projects ADD COLUMN slack_channel TEXT`);
  safeAlter(sqlite, `ALTER TABLE projects ADD COLUMN slack_notify_on TEXT`);
  safeAlter(sqlite, `ALTER TABLE projects ADD COLUMN default_judge_id TEXT`);
  safeAlter(sqlite, `ALTER TABLE projects ADD COLUMN default_model TEXT DEFAULT 'gpt-4o-mini'`);
  safeAlter(sqlite, `ALTER TABLE projects ADD COLUMN cost_per_1k_input REAL`);
  safeAlter(sqlite, `ALTER TABLE projects ADD COLUMN cost_per_1k_output REAL`);
  safeAlter(sqlite, `ALTER TABLE test_cases ADD COLUMN conversation_id TEXT`);
  safeAlter(sqlite, `ALTER TABLE test_cases ADD COLUMN difficulty TEXT DEFAULT 'medium'`);
  safeAlter(sqlite, `ALTER TABLE test_cases ADD COLUMN is_adversarial INTEGER DEFAULT 0`);
  safeAlter(sqlite, `ALTER TABLE test_cases ADD COLUMN adversarial_type TEXT`);
  safeAlter(sqlite, `ALTER TABLE test_cases ADD COLUMN source TEXT`);
  safeAlter(sqlite, `ALTER TABLE test_cases ADD COLUMN golden_set INTEGER DEFAULT 0`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN scheduled_run_id TEXT`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN model_used TEXT`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN total_input_tokens INTEGER`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN total_output_tokens INTEGER`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN total_cost REAL`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN pass_threshold INTEGER`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN is_gated INTEGER DEFAULT 0`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN approved_by TEXT REFERENCES users(id)`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN approved_at INTEGER`);
  safeAlter(sqlite, `ALTER TABLE runs ADD COLUMN approval_status TEXT`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN conversation_id TEXT`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN streaming_chunks TEXT`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN tool_calls_json TEXT`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN tokens_input INTEGER`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN tokens_output INTEGER`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN cost REAL`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN judge_criteria_id TEXT`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN consensus_rating TEXT`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN consensus_score INTEGER`);
  safeAlter(sqlite, `ALTER TABLE run_results ADD COLUMN safety_flagged INTEGER DEFAULT 0`);
}

// Lazy proxy — DB only created at runtime, not build time
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export { schema };
