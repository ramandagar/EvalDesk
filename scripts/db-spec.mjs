// ============================================================================
// EvalDesk table spec — the SINGLE source of truth for the database schema.
//
// This is a typeless, dialect-agnostic description of every table. The codegen
// (scripts/gen-schema.mjs) reads it and emits TWO real, checked-in Drizzle
// modules: src/db/schema.pg.ts (Postgres) and src/db/schema.sqlite.ts (SQLite).
// A CI drift guard re-runs codegen and fails the build on any diff, so the two
// dialects can never silently diverge.
//
// Column kinds (mapped per-dialect by the generator):
//   id    -> text PK, app-generated id (createId)
//   text  -> text
//   ts    -> epoch-MILLIS integer on BOTH engines (PG bigint) so sort/compare
//            semantics are identical across drivers (architectural rule)
//   json  -> jsonb (PG) / text json-mode (SQLite); opaque whole documents only
//   bool  -> boolean (PG) / integer 0|1 (SQLite)
//   num   -> numeric (PG) / real (SQLite)
//   fk    -> text referencing { ref: "table.column", onDelete }
//
// Per-column options: { kind, nullable?, default?, ref?, onDelete? }
//   default: only literal string/number/boolean DB defaults. Timestamps and
//            ids are set in the repository layer via an injected clock/id, NOT
//            DB defaults, to keep generated SQL deterministic and dialect-free.
// ============================================================================

/** @typedef {{kind:string, nullable?:boolean, default?:any, ref?:string, onDelete?:string}} Col */
/** @typedef {{name:string, columns:Record<string,Col>, uniques?:string[][], indexes?:string[][]}} Table */

/** @type {Table[]} */
export const tables = [
  {
    name: "organizations",
    columns: {
      id: { kind: "id" },
      name: { kind: "text", nullable: false },
      slug: { kind: "text", nullable: false },
      plan_id: { kind: "text", nullable: true },
      signing_key_id: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
      archived_at: { kind: "ts", nullable: true },
    },
    uniques: [["slug"]],
  },

  {
    name: "users",
    columns: {
      id: { kind: "id" },
      name: { kind: "text", nullable: false },
      email: { kind: "text", nullable: false },
      password_hash: { kind: "text", nullable: true },
      email_verified: { kind: "ts", nullable: true },
      image: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["email"]],
  },

  {
    name: "memberships",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      user_id: { kind: "fk", ref: "users.id", onDelete: "cascade", nullable: false },
      // role: owner | admin | reviewer | viewer
      role: { kind: "text", nullable: false, default: "viewer" },
      invited_by: { kind: "text", nullable: true },
      invited_at: { kind: "ts", nullable: true },
      accepted_at: { kind: "ts", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["org_id", "user_id"]],
    indexes: [["user_id"]],
  },

  {
    name: "sessions",
    columns: {
      id: { kind: "id" },
      user_id: { kind: "fk", ref: "users.id", onDelete: "cascade", nullable: false },
      // the org the session is currently acting within
      org_id: { kind: "text", nullable: true },
      token_hash: { kind: "text", nullable: false },
      ip: { kind: "text", nullable: true },
      user_agent: { kind: "text", nullable: true },
      last_seen_at: { kind: "ts", nullable: true },
      revoked_at: { kind: "ts", nullable: true },
      expires_at: { kind: "ts", nullable: false },
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["token_hash"]],
    indexes: [["user_id"]],
  },

  // ---------------------------------------------------------------------------
  // Domain tables — the eval loop. Every row is org-scoped; repos filter by
  // org_id so cross-tenant access is structurally impossible.
  // ---------------------------------------------------------------------------
  {
    name: "projects",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      name: { kind: "text", nullable: false },
      description: { kind: "text", nullable: true },
      agent_endpoint: { kind: "text", nullable: true },
      agent_method: { kind: "text", nullable: false, default: "POST" },
      agent_type: { kind: "text", nullable: true }, // openai | openrouter | langchain | custom
      agent_headers: { kind: "json", nullable: true }, // non-secret custom headers
      default_model: { kind: "text", nullable: false, default: "gpt-4o-mini" },
      created_by: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
      updated_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"]],
  },

  {
    name: "secrets",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      ref_type: { kind: "text", nullable: false }, // e.g. "project"
      ref_id: { kind: "text", nullable: false },
      name: { kind: "text", nullable: false }, // e.g. "agent_api_key"
      ciphertext: { kind: "text", nullable: false }, // AES-256-GCM blob (never plaintext)
      created_at: { kind: "ts", nullable: false },
      updated_at: { kind: "ts", nullable: false },
    },
    uniques: [["org_id", "ref_type", "ref_id", "name"]],
  },

  {
    name: "test_cases",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      project_id: { kind: "fk", ref: "projects.id", onDelete: "cascade", nullable: false },
      title: { kind: "text", nullable: false },
      input: { kind: "text", nullable: false },
      expected_output: { kind: "text", nullable: true },
      category: { kind: "text", nullable: true },
      order: { kind: "int", nullable: false, default: 0 },
      created_at: { kind: "ts", nullable: false },
      updated_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"], ["project_id"]],
  },

  {
    name: "runs",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      project_id: { kind: "fk", ref: "projects.id", onDelete: "cascade", nullable: false },
      name: { kind: "text", nullable: true },
      status: { kind: "text", nullable: false, default: "queued" }, // queued|running|completed|failed
      total_cases: { kind: "int", nullable: false, default: 0 },
      pass_count: { kind: "int", nullable: false, default: 0 },
      fail_count: { kind: "int", nullable: false, default: 0 },
      partial_count: { kind: "int", nullable: false, default: 0 },
      unrated_count: { kind: "int", nullable: false, default: 0 },
      pass_rate: { kind: "int", nullable: true }, // 0-100
      trigger_type: { kind: "text", nullable: false, default: "manual" },
      triggered_by: { kind: "text", nullable: true },
      model_used: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
      completed_at: { kind: "ts", nullable: true },
    },
    indexes: [["org_id"], ["project_id"]],
  },

  {
    name: "run_results",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      run_id: { kind: "fk", ref: "runs.id", onDelete: "cascade", nullable: false },
      test_case_id: { kind: "fk", ref: "test_cases.id", onDelete: "cascade", nullable: false },
      agent_response: { kind: "text", nullable: true }, // agent output ONLY; ratings/scores are separate layers
      response_time_ms: { kind: "int", nullable: true },
      status: { kind: "text", nullable: false, default: "pending" }, // pending|completed|error|timeout
      error_message: { kind: "text", nullable: true },
      needs_human: { kind: "bool", nullable: false, default: false },
      created_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"], ["run_id"]],
  },

  {
    name: "jobs",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      type: { kind: "text", nullable: false }, // run.execute | run.judge | ...
      payload: { kind: "json", nullable: true },
      status: { kind: "text", nullable: false, default: "queued" }, // queued|running|completed|failed
      attempts: { kind: "int", nullable: false, default: 0 },
      max_attempts: { kind: "int", nullable: false, default: 3 },
      run_after: { kind: "ts", nullable: false }, // epoch-ms; claim when run_after <= now
      locked_at: { kind: "ts", nullable: true },
      locked_by: { kind: "text", nullable: true },
      last_error: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
      updated_at: { kind: "ts", nullable: false },
    },
    indexes: [["status"], ["org_id"]],
  },

  {
    name: "api_keys",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      project_id: { kind: "text", nullable: true },
      name: { kind: "text", nullable: false },
      key_hash: { kind: "text", nullable: false },
      key_prefix: { kind: "text", nullable: false },
      scopes: { kind: "json", nullable: true },
      created_by: { kind: "text", nullable: true },
      last_used_at: { kind: "ts", nullable: true },
      expires_at: { kind: "ts", nullable: true },
      revoked_at: { kind: "ts", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["key_hash"]],
    indexes: [["org_id"]],
  },

  // ---------------------------------------------------------------------------
  // Phase 3 — the wedge: shared rubric scale + three append-only verdict layers
  // (ai_scores / human_ratings / adjudications) + the calibration/agreement
  // outputs. AI and humans rate on the SAME enumerated rubric label space so
  // agreement (kappa) and AI-vs-human calibration are exact joins, not fuzzy
  // mappings. ai_scores/human_ratings are immutable; corrections append.
  // ---------------------------------------------------------------------------
  {
    name: "rubrics",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      project_id: { kind: "fk", ref: "projects.id", onDelete: "cascade", nullable: false },
      name: { kind: "text", nullable: false },
      version: { kind: "int", nullable: false, default: 1 },
      kind: { kind: "text", nullable: false, default: "ordinal" }, // ordinal | nominal
      labels: { kind: "json", nullable: false }, // ordered label space e.g. ["fail","partial","pass"]
      scale_min: { kind: "int", nullable: true },
      scale_max: { kind: "int", nullable: true },
      always_human: { kind: "bool", nullable: false, default: false }, // routing: rubric.alwaysHuman
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["project_id", "name", "version"]], // immutable per version
    indexes: [["org_id"], ["project_id"]],
  },

  {
    name: "ai_scores",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      run_result_id: { kind: "fk", ref: "run_results.id", onDelete: "cascade", nullable: false },
      rubric_version_id: { kind: "text", nullable: true }, // immutable rubric ref (pins the scale)
      judge_config_version_id: { kind: "text", nullable: true },
      provider: { kind: "text", nullable: true },
      model: { kind: "text", nullable: false }, // requested model
      model_resolved: { kind: "text", nullable: true }, // provider-echoed id
      prompt_hash: { kind: "text", nullable: true }, // sha256 of rendered prompt (reproducibility)
      label: { kind: "text", nullable: false }, // ∈ rubric.labels
      score_num: { kind: "num", nullable: true },
      confidence: { kind: "num", nullable: true }, // honest computed confidence [0,1]
      self_consistency: { kind: "num", nullable: true },
      disagreement: { kind: "num", nullable: true },
      rationale: { kind: "text", nullable: true },
      raw: { kind: "json", nullable: true },
      idempotency_key: { kind: "text", nullable: false }, // sha256(resultId+specHash+attemptGroup)
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["idempotency_key"]], // at-least-once queue cannot double-count calibration/cost
    indexes: [["org_id"], ["run_result_id"]],
  },

  {
    name: "human_ratings",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      run_result_id: { kind: "fk", ref: "run_results.id", onDelete: "cascade", nullable: false },
      rubric_version_id: { kind: "text", nullable: true },
      reviewer_id: { kind: "text", nullable: true }, // canonical identity snapshotted, not read live
      label: { kind: "text", nullable: false }, // ∈ rubric.labels
      score_num: { kind: "num", nullable: true },
      rationale: { kind: "text", nullable: true },
      confidence: { kind: "num", nullable: true },
      supersedes_id: { kind: "text", nullable: true }, // correction chain; current = non-superseded
      credential_snapshot: { kind: "json", nullable: true },
      signature: { kind: "text", nullable: true },
      signing_key_id: { kind: "text", nullable: true },
      attempt_id: { kind: "text", nullable: false }, // idempotent submission key
      signed_at: { kind: "ts", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    // idempotent submit: a retried POST with the same attempt is a no-op
    uniques: [["run_result_id", "reviewer_id", "attempt_id"]],
    // exactly one CURRENT (non-superseded) row per reviewer per result
    partialUniques: [{ cols: ["run_result_id", "reviewer_id"], whereNull: "supersedes_id" }],
    indexes: [["org_id"], ["run_result_id"]],
  },

  {
    name: "adjudications",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      run_result_id: { kind: "fk", ref: "run_results.id", onDelete: "cascade", nullable: false },
      rubric_version_id: { kind: "text", nullable: true },
      final_label: { kind: "text", nullable: false },
      method: { kind: "text", nullable: false }, // consensus | human-wins | cohen | fleiss
      weighting_scheme: { kind: "text", nullable: true },
      agreement_summary: { kind: "json", nullable: true },
      decided_by: { kind: "text", nullable: true },
      decided_at: { kind: "ts", nullable: false },
      locked: { kind: "bool", nullable: false, default: false },
    },
    uniques: [["run_result_id"]], // one adjudication per result
    indexes: [["org_id"]],
  },

  {
    name: "agreement_metrics",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      scope_type: { kind: "text", nullable: false }, // run | project | dataset
      scope_id: { kind: "text", nullable: false },
      rubric_version_id: { kind: "text", nullable: true },
      ai_human_agreement_pct: { kind: "num", nullable: true },
      ai_human_confusion: { kind: "json", nullable: true },
      kappa: { kind: "num", nullable: true },
      kappa_method: { kind: "text", nullable: true }, // cohen | fleiss
      weighting_scheme: { kind: "text", nullable: true },
      n_items: { kind: "int", nullable: true },
      n_raters: { kind: "int", nullable: true },
      ci_lo: { kind: "num", nullable: true },
      ci_hi: { kind: "num", nullable: true },
      window_start: { kind: "ts", nullable: true },
      window_end: { kind: "ts", nullable: true },
      computed_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"], ["scope_type", "scope_id"]],
  },

  {
    name: "judge_calibration",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      project_id: { kind: "fk", ref: "projects.id", onDelete: "cascade", nullable: false },
      judge_model: { kind: "text", nullable: false },
      judge_prompt_hash: { kind: "text", nullable: true },
      weighting_scheme: { kind: "text", nullable: true },
      window_start: { kind: "ts", nullable: true },
      window_end: { kind: "ts", nullable: true },
      sample_n: { kind: "int", nullable: true },
      audit_sample_n: { kind: "int", nullable: true },
      agreement_pct: { kind: "num", nullable: true },
      weighted_kappa: { kind: "num", nullable: true },
      confusion: { kind: "json", nullable: true },
      bias: { kind: "json", nullable: true },
      mean_abs_score_error: { kind: "num", nullable: true },
      tau: { kind: "num", nullable: true }, // learned auto-finalize threshold (null = cold start)
      published: { kind: "bool", nullable: false, default: false },
      computed_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"], ["project_id"]],
  },

  // ---------------------------------------------------------------------------
  // Phase 4 — sign-off & the signed compliance artifact. A signoff_policy sets
  // the quorum (min reviewers, required role, optional kappa gate). run_signoffs
  // is append-only; on quorum the finalize-and-sign worker locks the run and
  // writes an immutable, Ed25519-signed, offline-verifiable eval_certificate.
  // ---------------------------------------------------------------------------
  {
    name: "signoff_policies",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      project_id: { kind: "fk", ref: "projects.id", onDelete: "cascade", nullable: false },
      min_reviewers: { kind: "int", nullable: false, default: 1 },
      required_role: { kind: "text", nullable: true }, // e.g. "reviewer"
      require_verified_credential: { kind: "bool", nullable: false, default: false },
      min_kappa: { kind: "num", nullable: true }, // optional inter-rater agreement gate
      is_active: { kind: "bool", nullable: false, default: true },
      created_by: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"], ["project_id"]],
  },

  {
    name: "run_signoffs",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      run_id: { kind: "fk", ref: "runs.id", onDelete: "cascade", nullable: false },
      reviewer_id: { kind: "text", nullable: false },
      decision: { kind: "text", nullable: false }, // approve | reject
      note: { kind: "text", nullable: true },
      credential_snapshot: { kind: "json", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["run_id", "reviewer_id"]], // one current signoff per reviewer per run
    indexes: [["org_id"], ["run_id"]],
  },

  {
    name: "signing_keys",
    columns: {
      id: { kind: "id" },
      // null org_id = per-instance key (self-host); set = per-org (cloud)
      org_id: { kind: "text", nullable: true },
      public_key_pem: { kind: "text", nullable: false },
      private_key_secret_id: { kind: "text", nullable: true }, // ref into secrets (encrypted)
      algo: { kind: "text", nullable: false, default: "ed25519" },
      created_at: { kind: "ts", nullable: false },
      retired_at: { kind: "ts", nullable: true },
    },
    indexes: [["org_id"]],
  },

  {
    name: "eval_certificates",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      run_id: { kind: "fk", ref: "runs.id", onDelete: "cascade", nullable: false },
      content_hash: { kind: "text", nullable: false }, // sha256 of canonical bytes
      signature: { kind: "text", nullable: false }, // base64 Ed25519
      signing_key_id: { kind: "text", nullable: false },
      algo: { kind: "text", nullable: false, default: "ed25519" },
      public_key_pem: { kind: "text", nullable: false }, // bundled for offline verify
      canonical_json: { kind: "text", nullable: true }, // redactable
      payload: { kind: "json", nullable: true },
      weighting_scheme: { kind: "text", nullable: true },
      is_public: { kind: "bool", nullable: false, default: false },
      signed_at: { kind: "ts", nullable: false },
      expires_at: { kind: "ts", nullable: true },
    },
    uniques: [["run_id"]], // one certificate per finalized run (re-sign = new run version)
    indexes: [["org_id"]],
  },

  // ---------------------------------------------------------------------------
  // Phase 5 — webhooks. HMAC-signed, SSRF-checked, delivered via the jobs queue
  // with backoff. webhook_deliveries is an append-only attempt log.
  // ---------------------------------------------------------------------------
  {
    name: "webhooks",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      project_id: { kind: "text", nullable: true },
      url: { kind: "text", nullable: false },
      secret_ciphertext: { kind: "text", nullable: false }, // AES-GCM blob
      events: { kind: "json", nullable: false }, // subscribed event names
      is_active: { kind: "bool", nullable: false, default: true },
      created_by: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"], ["project_id"]],
  },

  {
    name: "webhook_deliveries",
    columns: {
      id: { kind: "id" },
      org_id: { kind: "fk", ref: "organizations.id", onDelete: "cascade", nullable: false },
      webhook_id: { kind: "fk", ref: "webhooks.id", onDelete: "cascade", nullable: false },
      event: { kind: "text", nullable: false },
      payload: { kind: "json", nullable: true },
      status: { kind: "text", nullable: false, default: "pending" }, // pending|delivered|failed
      attempts: { kind: "int", nullable: false, default: 0 },
      response_status: { kind: "int", nullable: true },
      last_error: { kind: "text", nullable: true },
      created_at: { kind: "ts", nullable: false },
      updated_at: { kind: "ts", nullable: false },
    },
    indexes: [["org_id"], ["webhook_id"]],
  },

  // ---------------------------------------------------------------------------
  // Rate limiting — fixed-window counters (no Redis). One row per (bucket,
  // window_start); the limiter upserts and reads count. Auth limiters fail
  // CLOSED (a store error denies); a GC removes old windows.
  // ---------------------------------------------------------------------------
  {
    name: "rate_limits",
    columns: {
      id: { kind: "id" },
      bucket: { kind: "text", nullable: false }, // e.g. "auth:login:ip:1.2.3.4"
      window_start: { kind: "ts", nullable: false }, // epoch-ms window boundary
      count: { kind: "int", nullable: false, default: 0 },
    },
    uniques: [["bucket", "window_start"]],
    indexes: [["window_start"]],
  },

  // Password-reset tokens. Only the SHA-256 hash is stored; single-use, expiring.
  {
    name: "password_reset_tokens",
    columns: {
      id: { kind: "id" },
      user_id: { kind: "fk", ref: "users.id", onDelete: "cascade", nullable: false },
      token_hash: { kind: "text", nullable: false },
      expires_at: { kind: "ts", nullable: false },
      used_at: { kind: "ts", nullable: true },
      created_at: { kind: "ts", nullable: false },
    },
    uniques: [["token_hash"]],
    indexes: [["user_id"]],
  },
];

// Drizzle export name for a table (camelCase singular-ish — we keep the plural
// table name but camelCase the identifier).
export function exportName(tableName) {
  return tableName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
