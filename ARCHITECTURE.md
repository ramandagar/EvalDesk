# EvalDesk Architecture

EvalDesk is an evaluation platform for AI agents built on a single thesis: **AI-native, expert-verified.** An AI judge scores every agent answer in seconds; a credentialed domain expert (doctor, lawyer, compliance officer) verifies the answers where the AI is uncertain or where multiple judges disagree; and the platform *measures the gap* between machine and human judgment as a first-class, queryable product output — AI-judge-vs-human calibration, and human-vs-human Cohen's/Fleiss kappa. The deliverable for a regulated buyer is an immutable, cryptographically signed, offline-verifiable evaluation record that maps evals to regulatory controls.

**The wedge.** Engineer-first tools — DeepEval, Langfuse, Braintrust, Phoenix, Confident AI — are libraries and dashboards for people who write code. None of them combine the four things a regulated AI startup actually needs: (1) a *non-technical, zero-code reviewer* as a first-class actor; (2) a *signed, auditable compliance artifact*; (3) *built-in inter-rater agreement and AI-vs-human calibration math*; and (4) *true open-source self-host with data residency* in one product. Confident AI is the nearest competitor — it courts domain-expert alignment — but it is closed cloud, and it never quantifies agreement or calibration, never signs a record, and ships no regulated-domain modules. EvalDesk holds all four simultaneously, behind a one-`docker compose up` self-host that beats Langfuse's four-service (ClickHouse + Redis + S3 + Postgres) stack. Beachhead: health-tech AI startups, with HIPAA/RBI/EU-AI-Act suites as pluggable commercial modules. The buyer is the AI startup; the expert is a seat the buyer invites, not the payer.

---

## Architectural Principles

These principles are non-negotiable and thread through every subsystem below. Where two subsystem designs implied different mechanisms, the reconciliation is stated explicitly.

1. **Security-by-default.** Every domain row carries `org_id`; every query is org-scoped through one of two sanctioned guards; cross-tenant access returns `404`, never `403` (no enumeration). Secrets are envelope-encrypted at rest. The agent runner and webhook delivery are SSRF-hardened with connect-time IP pinning. Auth is opaque signed sessions, not a forgeable cookie. IDOR, the current product's defining flaw, is made *structurally impossible*, not merely patched.

2. **Thin routes, fat services.** A route handler does exactly four things: authenticate + resolve org (`requireMember`/`withAuth`), validate input (zod), load any id through `loadInOrg`/`loadChildInOrg`, then call a `ctx`-injected service in `src/lib/services/*`. Handlers may not import `@/db` or call `fetch` directly. This is enforced by ESLint, a CI grep gate (to catch dynamic `require("@/db")`), and a route-migration allowlist test — three layers, because static linting alone has holes.

3. **AI is a suggestion, never a verdict.** The AI judge writes to an immutable `ai_scores`/`judge_suggestions` layer only. A human verdict is a separate append-only row per reviewer. The final adjudication is a derived third layer. The AI subsystem *measures the gap* between layers; it never mutates a human verdict. This three-layer separation IS "expert-verified, AI-native."

4. **Dual-driver, one codebase.** The app runs identically on Postgres (cloud) and better-sqlite3 (self-host) behind one driver interface. No `pgvector`, no array columns, no JSONB operators, no `date_trunc`/`strftime` in shared/repo query paths. Anything ever filtered or joined on is a typed column; JSON columns hold opaque whole documents. Vector/full-text features live behind capability flags and degrade gracefully (brute-force cosine in JS on SQLite).

5. **Async-by-default.** No LLM I/O or run execution happens on the request thread. Runs are jobs on a Postgres/SQLite-backed queue drained by a worker. The request path enqueues and returns `202`; completion is learned by polling. There is no Redis — the queue is a `jobs` table.

6. **Open-core.** The MIT core is a *complete, self-hostable product*: full eval engine, provider abstraction, async runs, human review, multi-reviewer kappa, calibration, signed certificates, hash-chained audit log, SQLite + Postgres. Commercial adds SSO/SCIM, hosted multi-tenant cloud, prebuilt compliance suites (HIPAA/RBI/EU-AI-Act as pluggable npm packages), advanced analytics, and SLA support. The boundary is CI-enforced — the MIT build compiles and runs a full eval with the commercial registry disabled.

7. **Test-gated.** No feature merges until it is implemented *and* tested at the right layer. Security and the wedge (signed records, kappa, calibration, dual-driver parity, zero-egress) are protected by mandatory must-pass attack/golden corpora, not a coverage percentage. The build proceeds one feature at a time: implement, test, verify, then move on.

---

## System Overview

```
                          ┌───────────────────────────────────────────┐
                          │  Vercel — MARKETING ONLY (static)           │
                          │  /  /blog  /pricing  → links to app host    │
                          └───────────────────────────────────────────┘

   CLIENTS                         API LAYER                        SERVICES                       DATA
 ┌───────────┐   HTTPS    ┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────┐
 │ Browser   │──session──▶│ Next.js App Router        │   │ CORE DOMAIN              │   │ Driver interface │
 │ (RSC +    │            │  middleware: presence gate│   │  projects/testcases/runs │   │  ┌────────────┐  │
 │  islands) │            │  (Edge, NOT the boundary) │──▶│  reviewer verdicts       │──▶│  │ Postgres   │  │
 ├───────────┤            ├──────────────────────────┤   │  signoff / adjudication  │   │  │  (cloud)   │  │
 │ Python SDK│  Bearer    │ /api/v1/* (public REST)   │   ├──────────────────────────┤   │  └────────────┘  │
 │ TS SDK    │──key──────▶│  withAuth→withScope→      │   │ AI SUBSYSTEM             │   │  ┌────────────┐  │
 │ GH Action │            │   withRole→scoped(ctx)    │   │  providers / judge /     │   │  │ better-    │  │
 ├───────────┤            ├──────────────────────────┤   │  ensemble / calibration /│   │  │ sqlite3    │  │
 │ Webhooks  │◀──signed───│ /api/* (internal session) │   │  kappa / cluster / SSRF  │   │  │ (self-host)│  │
 │ receiver  │   HMAC     │  dashboards, billing      │   ├──────────────────────────┤   │  └────────────┘  │
 └───────────┘            └──────────────────────────┘   │ RUNTIME / JOBS           │   │  repos/* only    │
                                       │  enqueue           │  Queue iface + 2 adapters│   └──────────────────┘
                                       │  (202)             │  worker handlers, cron   │           ▲
                                       ▼                    └──────────────────────────┘           │
                          ┌──────────────────────────┐                 │ claim / complete          │
                          │ jobs table (queue)        │◀────────────────┘  (FOR UPDATE SKIP LOCKED  │
                          └──────────────────────────┘                     / BEGIN IMMEDIATE) ──────┘
                                       ▲
                                       │ drains
                          ┌──────────────────────────┐
                          │ WORKER PROCESS            │  run.execute → run.judge → (annotation queue)
                          │ (separate container on PG;│  → review.settled → calibration.recompute
                          │  in-process on SQLite)    │  → cert.sign  (+ seal-audit-chain cron)
                          └──────────────────────────┘
```

**Deploy topology — determined by `DB_DRIVER`, not a free choice:**

- **Cloud / scaled self-host (`DB_DRIVER=postgres`):** N stateless `app` containers + M `worker` containers, all pointing at one Postgres, on a container host (Railway/Render/Fly). True multi-process concurrency via `FOR UPDATE SKIP LOCKED`. Worker is its own entrypoint `node dist/worker/index.js`. Migrations run as a one-shot advisory-locked release step.
- **Minimal self-host (`DB_DRIVER=sqlite`):** exactly ONE container. The worker loop runs *in-process*, started from Next.js 15 `instrumentation.ts` `register()` (the supported server-startup hook, compatible with `output: "standalone"` — no custom `server.ts`). A second process opening the same SQLite file as a writer is forbidden and asserted against at boot. `docker compose up` brings up the single app service with a local volume. This is the one-command promise.
- **Marketing** is static and lives on Vercel; it only links to `app.evaldesk.dev`. The real app never runs on Vercel (no worker, no long-lived connections).

---

## Data Model & Multi-Tenancy

Every domain row is owned by an `organizations` tenant; every query filters by `org_id`. Drizzle migrations are the **sole** source of truth — the legacy hand-written `initTables()`/`safeAlter()` DDL and the `db` Proxy's home-grown schema management are deleted. App and worker refuse to boot if the migration head does not match expected.

### Dual-driver strategy (codegen + repository layer)

We reject the fantasy that "one generic factory yields precise per-dialect types." Instead:

- **`src/db/spec.ts`** — a typeless data spec: table descriptors `{ name, columns:{kind,nullable,default,refs}, indexes, uniques }`.
- **`scripts/gen-schema.ts`** — build-time codegen emitting two real, checked-in modules: `src/db/schema.pg.ts` (`pgTable`) and `src/db/schema.sqlite.ts` (`sqliteTable`), so Drizzle infers precise types per dialect. CI fails if regenerating produces a diff (drift guard).
- **`src/db/index.ts`** — rebuilt. `DB_DRIVER` selects `drizzle(pgPool,…)` or `drizzle(sqlite,…)`. The lazy `Proxy` survives but is typed as a discriminated union. It also sets `pragma busy_timeout=5000` on SQLite.
- **`src/db/repos/*`** — **all query code goes through repository functions.** App routes and the worker NEVER import a schema table directly. Each repo has two private impls selected by `DB_DRIVER`; the public signature is dialect-agnostic and fully typed. The union-type erasure is confined to repos; app code stays typed and testable against an in-memory SQLite.
- **`src/db/columns.ts`** — the only place type divergence lives: `id()` (text PK, CUID2/nanoid), `fk(ref,onDelete)`, `ts(name)` (PG `timestamptz` / SQLite integer epoch-ms), `json(name)` (PG `jsonb` / SQLite text JSON-mode), `bool`, `num(name,precision)` (PG `numeric` / SQLite `real`), and `partialUniqueIndex(cols, whereSql)` (both engines support partial indexes).

**Hard portability rules:** no `pgvector`, no array columns, no JSONB operators, no dialect date functions in shared paths. **Timestamps stored as epoch-ms `bigint` even on Postgres in shared query paths** so sort semantics are identical across drivers. Anything filtered/joined on is a typed column.

### Tenancy & identity

```
organizations(id, name, slug uniq, plan_id, signing_key_id, created_at, archived_at)
memberships(id, org_id, user_id, role, invited_by, invited_at, accepted_at, UNIQUE(org_id,user_id))
                                         -- role: owner | admin | reviewer | viewer
users(... keep bcrypt; DELETE global users.role; passwordless loginOrCreate DELETED)
sessions(id, user_id, org_id /*active*/, token_hash uniq, revoked_at, expires_at,
         last_seen_at, ip, user_agent, created_at)
api_keys(id, org_id, project_id?, name, key_hash, key_prefix, scopes json,
         created_by, last_used_at, expires_at, revoked_at)
reviewer_credentials(id, membership_id, kind, license_ref, specialty, verified_at, verified_by)
```

`memberships.role` replaces the dead global `users.role` and is what `src/lib/roles.ts` finally enforces. **Role/verdict reconciliation:** the `reviewer` role is the invited domain-expert seat — it can submit verdicts AND adjudicate within queues assigned to it. `roles.ts` gains an `adjudicate` capability: `reviewer:[read,write,rate,adjudicate]`, decoupled from admin's `canApprove`. Viewer is read-only. Reviewers never see billing, keys, or run config (RBAC-enforced, not UI-hidden).

### Domain tables and the verdict separation (the wedge, encoded structurally)

All domain tables gain `org_id` + composite `(org_id, <fk>)` indexes. `projects` loses plaintext `agent_api_key`/`agent_headers` (moved to `secrets`). `judge_criteria` becomes versioned `judge_configs` (versions immutable; edit = new row).

**Calibration is impossible unless AI and humans rate on the SAME enumerated scale.** A versioned per-project `rubrics` table pins the label space both layers reference:

```
rubrics(id, org_id, project_id, name, version, kind 'ordinal'|'nominal',
        labels json /* ["fail","partial","pass"] ordered */, scale_min, scale_max,
        UNIQUE(project_id,name,version))                     -- immutable per version

run_results(id, org_id, run_id, test_case_id, agent_response /*redactable*/,
            response_time_ms, status, tokens_in, tokens_out, cost, tool_calls json,
            needs_human bool, created_at)                    -- agent output ONLY; no ratings

ai_scores(id, org_id, run_result_id, rubric_version_id, judge_config_version_id,
          provider, model, model_resolved, prompt_hash, label /*∈ rubric.labels*/,
          score_num, confidence num, self_consistency num, rationale, raw json,
          idempotency_key uniq, created_at)                  -- layer (a); many per result

human_ratings(id, org_id, run_result_id, rubric_version_id, reviewer_id,
              label /*∈ rubric.labels*/, score_num, rationale, confidence num,
              supersedes_id?, credential_snapshot json, signature, signing_key_id,
              attempt_id, signed_at, created_at)             -- layer (b); one CURRENT row/reviewer

adjudications(id, org_id, run_result_id, rubric_version_id, final_label, method,
              weighting_scheme, agreement_summary json, decided_by, decided_at, locked bool)
```

Both `ai_scores.label` and `human_ratings.label` are constrained (app-level + PG CHECK) to the rubric version's labels, so AI-vs-human agreement and inter-rater kappa are *exact joins on a shared categorical scale*. `ai_scores` records `prompt_hash` + exact `model`/`params` — never a FK to a mutable config (reproducibility). `human_ratings` is append-only: a correction inserts a new row with `supersedes_id`; the current row is the latest non-superseded per reviewer, enforced by a committed **partial unique index** on both engines:

```sql
CREATE UNIQUE INDEX uq_human_current ON human_ratings(run_result_id, reviewer_id)
  WHERE supersedes_id IS NULL;
```

Idempotent submission uses `(run_result_id, reviewer_id, attempt_id)` uniqueness so a retried POST is a no-op — duplicate verdicts can never corrupt kappa. Reviewer/actor FKs are `ON DELETE SET NULL`; canonical identity is *snapshotted* at sign time (`credential_snapshot`), not read live.

### Calibration & agreement tables

```
agreement_metrics(id, org_id, scope_type 'run'|'project'|'dataset', scope_id,
                  rubric_version_id, ai_human_agreement_pct num, ai_human_confusion json,
                  kappa num, kappa_method 'cohen'|'fleiss', weighting_scheme, n_items,
                  n_raters, ci_lo, ci_hi, computed_at, window_start, window_end)
judge_calibration(id, org_id, project_id, judge_model, judge_prompt_hash, weighting_scheme,
                  window_start, window_end, sample_n, audit_sample_n, agreement_pct,
                  weighted_kappa, confusion json, bias json, mean_abs_score_error, tau,
                  published bool, computed_at)
```

`needs_human` on `run_results` is the routing primitive: set true when judge confidence < τ, on multi-judge disagreement, on adversarial items, or for the mandatory random-audit sample. The worker recomputes metrics after verdicts land.

### Secrets — real envelope encryption

```
secrets(id, org_id, owner_type, owner_id, kind, ciphertext, dek_wrapped, iv, auth_tag,
        key_id, created_at, tombstoned_at?)
```

A per-secret random DEK (AES-256-GCM) encrypts the plaintext; the DEK is wrapped by the app KEK (`ENCRYPTION_KEY`, `key_id` versioned for cheap rotation). **AAD = `org_id:owner_type:owner_id:kind`** is bound into every GCM op so a ciphertext cannot be relocated cross-tenant or cross-owner. `projects` reference `secret` ids, never plaintext.

### Audit, signing, certificates

```
signing_keys(id, org_instance, public_key_pem, private_key_secret_id, algo 'ed25519',
             created_at, retired_at)
audit_event_inbox(id, org_id, payload_json, created_at)                 -- contention-free
audit_event(id, org_id, seq, actor_id, action, resource_type, resource_id,
            payload_json, payload_hash, prev_hash, hash, created_at)    -- sealed, hash-chained
eval_certificates(id, org_id, run_id, content_hash, signature, signing_key_id,
                  weighting_scheme, canonical_json /*redactable*/, reviewer_snapshot json,
                  is_public, signed_at, expires_at)                     -- immutable
```

Immutability is **DB-enforced**: `BEFORE UPDATE`/`BEFORE DELETE` triggers (`RAISE EXCEPTION` / `RAISE(ABORT)`) on append-only tables; even if a trigger is dropped, the hash chain covers verdict and signoff rows so tampering stays detectable. Cascades: `org → projects → run_results → ai_scores/human_ratings` `ON DELETE CASCADE`, EXCEPT certificates, audit_event, finalized human_ratings, and adjudications which are `RESTRICT`. Org deletion is soft-archive + crypto-shred, never a hard cascade over immutable records.

**Reproducibility vs GDPR/HIPAA:** redactable columns (`agent_response`, `canonical_json`, secret plaintext) are tombstoned to `{"redacted":true,"hash":<sha256>}` and the secret's DEK deleted (crypto-shred). The hash chain and certificate verify against `content_hash`/`row_hash` captured at sign time, so erasure preserves the immutable, verifiable skeleton.

### Jobs & schedules

```
jobs(id, org_id, type, status, payload json /*IDs+secretRef only*/, dedup_key, priority,
     attempts, max_attempts, run_after, cancel_requested, deadline_at,
     locked_by, locked_at, heartbeat_at, last_error, result, created_at, updated_at)
schedules(id, org_id, project_id, cron, timezone, next_run_at, last_run_at, is_active, created_by)
run_events(id, run_id, seq, …)                          -- SSE tail
org_inflight(org_id, inflight)                          -- transactional fairness counter
stripe_events(id pk, processed_at)                      -- webhook dedupe
rate_limits(key, window_start, count)                   -- fixed-window, no Redis
```

Every filterable field on `jobs` (`type`, `status`, `dedup_key`, `run_after`, `priority`) is a typed column; `payload` holds only an opaque blob. Indexes: partial `idx_jobs_claim (type,run_after,priority desc,created_at) WHERE status='queued'`; partial `idx_jobs_reap (heartbeat_at) WHERE status IN ('claimed','running')`; **partial unique** `uniq_jobs_dedup (org_id,dedup_key) WHERE status NOT IN (terminal) AND dedup_key IS NOT NULL` — dedup is tenant-scoped and only among live jobs, so a legitimate re-run after completion is allowed.

---

## The AI Subsystem

Everything lives under `src/lib/ai/`. Two hard rules: **(R1)** all LLM I/O happens in the worker, never the request thread; **(R2)** every shared query path runs identically on SQLite and Postgres. The current code hardcodes `api.openai.com` in 8 files, duplicates `callOpenAI` ~6 times, and lets `judge.ts` directly `UPDATE` `runResults`. We keep the prompts and parsers (they are real and good), keep `cost-tracker.ts` and `judge-templates.ts` verbatim, and rebuild transport, persistence, routing math, and the absent calibration/agreement layer.

### Provider abstraction (`src/lib/ai/providers/`)

One interface for both the agent-under-test and the judges; BYO tenant key only — **no platform-owned LLM key is ever in the eval path** (we never resell tokens).

```ts
interface Provider {
  readonly id: "openai" | "anthropic" | "openrouter" | "ollama";
  capabilities(): { streaming: boolean; embeddings: boolean; jsonMode: boolean };
  complete(p: CompleteParams): Promise<CompleteResult>;   // signal: AbortSignal REQUIRED
  embed?(texts: string[], model: string): Promise<{ vectors: number[][]; usage: Usage }>;
  estimateCost(usage: Usage, model: string): number;      // delegates to cost-tracker.ts
}
```

`resolveProvider(cred)` decrypts the tenant credential via `src/lib/crypto/envelope.ts`. Adapters: `openai`, `anthropic`, `openrouter` (OpenAI-shaped), `ollama` (local, no key; `jsonMode:false` forces the regex-parser path, `embeddings:true`). **Streaming is deliberately NOT on `Provider`** — a Postgres-queued worker has no socket to the browser and SQLite has no LISTEN/NOTIFY. Token streaming is confined to a separate synchronous playground route (`streamComplete.ts` used only by `/api/playground/stream`). `withResilience(fn,{timeoutMs,retries})` wraps every call: AbortController timeout, exponential backoff + full jitter on 429/5xx, and it always returns captured `usage` (estimated if absent) so cost is never lost.

### Budget gate before fan-out (`budget.ts`)

The worker computes `testCaseCount × judgeCount × estTokens × price` and checks it against the tenant's `runBudgetUsd`/`monthlyTokenQuota` **before** dispatching any LLM call. Over budget → `status:"rejected_budget"`, fail-closed. A running tally aborts mid-run on price drift. Ensemble spend on the tenant key is bounded.

### Judge engine and ensemble

`JudgeEngine` (replaces `judge.ts`) is **pure of DB** — takes data, returns an immutable `JudgeSuggestion`, never writes. The judge runs against a **frozen `JudgeSpec` snapshot** (rubric text, model, `promptHash` = sha256 of the fully-rendered prompt, `rubricVersion`, self-consistency `samples K`) — not a FK to a mutable config. When `samples>1` the judge is sampled K times at `temperature>0`; the modal label is taken and `selfConsistency` = modal-vote fraction (a real, non-circular confidence signal).

`JudgeEnsemble` (replaces `multi-judge.ts`) runs N distinct `JudgeSpec`s in parallel (`Promise.allSettled`, partial-failure tolerant). **The legacy `DEFAULT_MODELS=["gpt-4o-mini","gpt-4o","gpt-4o-mini"]` — two identical models reporting majority fraction as "agreement" — is deleted.** `runMultiJudge` dedupes models and requires ≥2 *distinct* models or falls back to single-judge with `disagreement=unknown`. **Disagreement = mean pairwise ordinal distance** on `{fail=0,partial=1,pass=2}` normalized to `[0,1]` — a pass-vs-fail split routes harder than pass-vs-partial, and it is non-degenerate at N=2 (unlike `1−modal/N`).

### Honest confidence and the closed routing loop

`confidence = clamp(0.4·selfReported + 0.4·selfConsistency + 0.2·ensembleAgreement)`. The dominant terms are **empirical** (K-sample vote stability, cross-judge agreement), not the circular score-vs-threshold distance. A model-emitted "confidence" token is never trusted. For a single judge with `samples=1`, `needsHuman` defaults to true unless the project explicitly opts into single-judge auto-finalize.

`needsHuman = published && confidence < τ || disagreement > 0 || fromRandomAudit || isAdversarial || rubric.alwaysHuman`. This is the closed loop into the annotation queue.

### Calibration — the wedge math (`calibration.ts`, pure)

Routing must not suffer **selection-bias circularity** (you cannot estimate judge accuracy only from the items the policy already routed). Two mechanisms:

- A **mandatory random audit sample** (default 5% of confident results) is *always* routed to humans regardless of confidence, giving unbiased judge-vs-human pairs across the full confidence range. **τ is computed only from this audit sample.**
- **Cold start:** until `auditSampleN ≥ 50` AND judge-vs-human kappa ≥ 0.4, τ is undefined → route on disagreement/adversarial/always-human only; calibration is computed but `published=false` (never shown as trustworthy, never cited in certificates).

`CalibrationReport` yields agreement %, a 3×3 confusion matrix, directional bias (`lenient`/`strict`/`balanced` from off-diagonal mass), `meanAbsScoreError`, `byConfidenceBucket` (the honesty check — does high-confidence actually agree with humans?), and a weekly `driftSeries`. **All windowing/date-bucketing lives in a dual-dialect repo and is computed in application code from fetched epoch-ms timestamps** — no `date_trunc`/`strftime`. The UI suppresses bias/drift below a minimum-n threshold (kappa-paradox mitigation).

### Agreement — inter-rater reliability (`kappa.ts` / `agreement.ts`, pure)

`cohensKappa`, `fleissKappa`, `weightedKappa` (linear/quadratic for the ordinal scale), `percentAgreement`, and `bootstrapCI`. The selected `method` (Cohen for exactly 2 full-overlap raters, else Fleiss) and `weightingScheme` are **frozen into `adjudications` and copied into the signed certificate** so a regulator reproduces the exact number. `n` and a bootstrap CI are surfaced alongside every kappa so buyers cannot over-trust a bare number on tiny/skewed samples.

### Agent-under-test runner + SSRF

`agent-runner.ts` is rebuilt into a worker task. The 5 duplicated `callX` adapters collapse to `provider.complete()` plus ONE `custom` HTTP adapter that **requires an explicit `responseJsonPath` extractor**. The current `data.response||data.output||…||JSON.stringify(data)` fallback is **deleted** — a missing path yields `status:"error"`, never a fabricated string that pollutes calibration. The synchronous `for` loop is gone; each test case is a queue task. SSRF guard detail is in §Security.

### Clustering (`cluster.ts`, opt-in triage)

Pure agglomerative clustering separated from I/O. Similarity is cosine over embeddings only if `capabilities().embeddings`, else Jaccard over shingles. **Embeddings persist as JSON-text and cosine is computed in JS — no pgvector, no array columns.** Off the hot path.

### Idempotent persistence (load-bearing)

The worker persists into the three append-only layers in a transaction that also flips the `jobs` row to `done`. Every suggestion write carries `idempotencyKey = sha256(resultId + judgeSpecHash + jobAttemptGroup)` with a UNIQUE constraint, so an at-least-once queue cannot double-count calibration or inflate cost metering. There is no code path where AI mutates a human verdict.

```
agent ─[Provider.complete, BYO key, SSRF-pinned, cost-capped]─▶ agentResponse
   ▼ (budget gate passed)
JudgeEnsemble (N distinct specs, K samples) ─▶ ai_scores (immutable, idempotent)
   ▼ consensus + ordinal disagreement + honest confidence
needsHuman? ─yes─▶ annotation queue ─▶ human_ratings (N rows, signed, append-only)
   │                                        ▼
   no ─▶ auto-finalize                 adjudication (consensus, human wins)
                                            ▼
            AgreementEngine(κ + CI) + CalibrationEngine(gap, audit-sample τ, persisted)
```

**Reproducibility caveat (honest):** `promptHash` + `modelRequested`/`modelResolved` pins prompt and provider-echoed id, but cannot pin weights behind moving aliases. Any spec using a non-dated alias (e.g. `gpt-4o`) is flagged "weights not pinned"; dated model ids are recommended for regulated runs.

---

## Security & Authorization

### Threat model (verified in repo)

`auth.ts` identity is an unsigned `evaldesk_user_id` cookie (forge any user); `loginOrCreate` is a passwordless backdoor; `middleware.ts` `pathname.includes(".")` bypasses auth for any dotted path and only checks cookie presence; `projects.agentApiKey`/`agentHeaders` are plaintext; `auditLog` is mutable; no `org_id` anywhere; `run/route.ts` is synchronous, IDOR'd, and SSRFs via raw `fetch(config.endpoint)`; `seed/route.ts` is an unauthenticated first-user privilege escalation.

### Sessions — opaque server-side tokens (no HMAC envelope, no Auth.js, no Lucia)

Auth.js fights org-membership and offline self-host; Lucia v3 is deprecated; a cookie HMAC envelope saves zero hot-path work (revocation/expiry always needs a DB read) while adding a second secret to lose — all rejected. We extend the existing `sessions` table. `createSession` mints `token = randomBytes(32)`, stores `sha256(token)`, sets cookie `ed_session = ${sessionId}.${token}` (HttpOnly, Secure, Lax, 30d rolling). `resolveSession` does a `timingSafeEqual` on the hash and rejects revoked/expired. The token *is* the secret; a DB leak yields no live sessions. `loginOrCreate` is DELETED; bcrypt `signup`/`login` KEPT.

### Middleware — presence gate only, never the boundary

Middleware runs on the Edge runtime and **cannot** touch better-sqlite3/Drizzle/Node `crypto`. Its only jobs: remove the `includes(".")` bypass; matcher excludes only static assets; check `ed_session` *presence* (redirect pages / 401 api when absent); enforce a strict public allowlist that explicitly includes `/api/billing/webhook` (Stripe), marketing, cert, and embed paths. Real validation + authorization happens in the route, in the Node runtime.

### The single authz contract — IDOR made structurally impossible

`src/lib/authz.ts`:

```ts
type Role = 'viewer'|'reviewer'|'admin'|'owner';   // ROLE_RANK 1..4
type Ctx  = { user: User; orgId: string; role: Role; sessionId: string };

requireMember(req, minRole): Promise<Ctx>     // resolve session → user; read active org from
                                              // ed_org cookie / X-EvalDesk-Org; SELECT membership;
                                              // org is NEVER read from the request body
loadInOrg(table, id, orgId)                   // ROOT tables: WHERE id=$id AND org_id=$orgId; miss→404
loadChildInOrg(childTable, childId, parentTable, orgId)  // CHILD tables: JOIN parent, verify parent.org_id
```

Two guards close the *nested* IDOR hole a single-table guard misses: (1) every domain table has a denormalized `org_id` set on insert from `ctx.orgId`, never trusted from input; (2) child rows (`run_results`, `human_ratings`, `conversation_messages`, etc.) are loaded via `loadChildInOrg` so the parent chain is re-derived in SQL. A DB CHECK/trigger asserts `child.org_id = parent.org_id`. Cross-org access returns `404`, never leaking existence. These two functions are the ONLY sanctioned way to fetch a domain row by id. The public REST surface reaches the same guarantee via a `withAuth → withScope → withRole` handler factory + a `scoped(ctx)` query helper that injects `eq(table.orgId, ctx.orgId)`; a CI test fails if any v1 handler reaches `db.` without `scoped()`.

### RBAC — enforced at the guard, default-deny

`viewer`=GET; `reviewer`=submit verdicts + act on annotation queue + adjudicate assigned queues (cannot see billing/keys); `admin`=manage projects/keys/runs; `owner`=billing/seats/org settings/signing-key rotation. Owner-only mutations emit a `security.*` audit event.

### Secret encryption — AES-256-GCM with AAD binding, fail-closed

`src/lib/crypto/envelope.ts`. KEK from `ENCRYPTION_KEY` (32 bytes); **bootstrap exits loudly if missing or <32 bytes** — no silent plaintext fallback. Per-secret DEK wrapped by KEK; `keyId` enables rotation by re-wrapping DEKs only. **AAD = `orgId:projectId:column`** defeats cross-tenant ciphertext-swap. Decryption happens only inside the worker; the settings UI shows a masked prefix. Key-loss is unrecoverable by design — docs mandate operator escrow; a `keys:rotate` CLI re-wraps DEKs under a new KEK.

### SSRF guard — connect-time IP pinning, TLS-correct, one shared module

`src/lib/net/safe-fetch.ts` replaces every raw `fetch` of a tenant URL (agent endpoints AND webhook URLs). We do **not** rewrite the URL to an IP (that breaks SNI/cert verification). We inject a custom `lookup` into a Node/undici Agent:

1. Enforce `https` (allow `http` only behind an explicit self-host loopback dev flag).
2. Resolve DNS to all A/AAAA records.
3. Reject ANY resolved IP in `127/8, 10/8, 172.16/12, 192.168/16, 169.254/16` (incl. `169.254.169.254`), `100.64/10` (CGNAT), `0.0.0.0`, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6.
4. **Pin the validated IP into the socket** — connection uses the original hostname for TLS so SNI/cert verification stays correct, closing the DNS-rebinding TOCTOU at connect time.
5. `redirect:'manual'` — re-run the full guard on every Location (max 3 hops).
6. AbortSignal timeout + max-bytes body cap; strip internal/forwarded headers.

The `resolver` is injectable so unit tests assert rebinding/private-IP rejection without real DNS. Validated at enqueue (fast feedback) and again at fetch (authoritative). Self-host operators may set `SSRF_ALLOWLIST` (CIDR) — opt-in, audit-logged.

### Immutable audit log — hash chain without a hot lock

The chain is built **asynchronously**, off the worker's hot path, so eval finalization is never serialized. Web requests/workers append to a contention-free `audit_event_inbox`. A single per-org `seal-audit-chain` worker task (claimed via `FOR UPDATE SKIP LOCKED` on PG / serialized writer on SQLite) drains the inbox in order, assigns monotonic `seq`, and computes `hash = sha256(canonicalJSON({seq, prevHash, action, resourceId, payloadHash, createdAt}))`. Only the sealer touches the chain pointer — exactly one writer, zero contention with the eval fleet, replacing the per-org `FOR UPDATE`-on-head bottleneck that would have globally locked SQLite. `verifyChain(orgId)` walks `seq` and recomputes hashes; any gap/mismatch is tamper. No UPDATE/DELETE; corrections are new rows.

### Seed, Stripe, rate limiting, validation

- **Seed:** first-user fallback deleted; requires `requireMember(owner)` + `ALLOW_SEED=true`; **404 in production**. Demo data is a CLI gated to empty DBs.
- **Stripe webhook:** in the public allowlist; verify on the **raw `req.text()`** body via `constructEvent`; dedupe on `event.id` in `stripe_events`.
- **Rate limiting:** Postgres/SQLite fixed-window counter, no Redis. **Auth endpoints FAIL CLOSED** on store error (with a circuit breaker so an outage doesn't hard-lock login forever); non-auth limiters fail open. A GC cron bounds the table.
- **Validation:** every handler zod-`.parse`es input before any service call; zod is the single input-trust boundary, `ctx.orgId` the single org-trust boundary.

---

## Runtime & Jobs

### Decision: a custom `jobs` table behind a `Queue` interface, NOT pg-boss

pg-boss binds us to Postgres-only SQL and cannot run on SQLite, forcing two divergent queues — exactly what the single-codebase rule forbids. We build a ~400-LOC queue on a `jobs` table behind a `Queue` interface with two adapters differing **only** in the claim/wakeup primitive. Retries, reaping, fairness, and dispatch are shared, driver-agnostic code.

```ts
interface Queue {
  enqueue(j): Promise<string>;
  claim(workerId, types, limit): Promise<Job[]>;
  heartbeat(jobId, workerId): Promise<{cancelRequested:boolean}>;
  complete(jobId, result?): Promise<void>;
  fail(jobId, err, retryable): Promise<void>;
  reapStale(staleMs): Promise<number>;
  requestCancel(orgId, filter): Promise<number>;
  waitForWork(timeoutMs): Promise<void>;     // PG: LISTEN/NOTIFY*; SQLite: in-process event/sleep
}
```

- **Postgres claim:** `UPDATE jobs SET status='claimed',… WHERE id IN (SELECT id FROM jobs WHERE status='queued' AND run_after<=now() AND type=ANY($types) AND org_id IN (<fair set>) ORDER BY priority DESC, run_after ASC LIMIT $n FOR UPDATE SKIP LOCKED) RETURNING *`. `enqueue` issues `pg_notify`; `waitForWork` does `LISTEN`. *For the SSE/progress read path specifically, LISTEN/NOTIFY is NOT used (it dies under PgBouncer transaction pooling); progress is always polling. LISTEN/NOTIFY is used only for the worker's own queue-wakeup where the worker holds a session connection.*
- **SQLite claim:** single-writer; `BEGIN IMMEDIATE; SELECT … LIMIT n; UPDATE; COMMIT`. No `SKIP LOCKED` (the write lock IS the lock). `waitForWork` is an in-process event (same process). **SQLite self-host runs EXACTLY ONE worker, asserted at boot.**

### Worker process — dependency-injected for testability

`buildWorker(deps)` where `deps = { queue, db, providers, safeFetch, signer, clock }` returns `{ runOnce, start, stop }`. Handlers are `(job, deps) => Promise<result>` pure functions — no module-singleton db access — unit-testable with fakes and a frozen clock. Loop: `claim()` up to `WORKER_CONCURRENCY` into a bounded pool; `heartbeat()` every 10s (honors `cancel_requested` → cooperative `AbortController`); `reapStale` throttled to once per 15s (kills the write-storm). Graceful SIGTERM releases locks. A `/healthz` endpoint (last claim/heartbeat within 60s) lets the host restart a silently-dead worker.

**Job graph closes the wedge loop:**

| Job type | Handler | Replaces |
|---|---|---|
| `run.execute` | decrypt agent secret; iterate test cases in batches via provider + safeFetch; upsert `run_results` on `(run_id,test_case_id)`; enqueue `run.judge` per result; honor cancel/deadline; denormalize progress counters onto the `runs` row | sync `executeRun`, `multi-turn-runner`, fake `streaming-runner` (deleted) |
| `run.judge` | judge via tenant key; persist immutable `ai_scores` snapshot + honest confidence; on retry-exhaustion mark `judge_error` and **still route to human** (fail-safe, never silently unjudged); route low-confidence/disagreement into annotation queue; enqueue `calibration.recompute` | inline judge calls |
| `review.settled` | recompute adjudication + run stats from `human_ratings` (NOT the dropped `humanRating`) | new — wedge |
| `calibration.recompute` | recompute agreement % + confusion + kappa from the audit sample; persist | new — wedge |
| `seal-audit-chain` | one-per-org sealer; drain inbox → seq + hash chain | new |
| `cert.sign` | on finalize, serialize canonical JSON, SHA-256, Ed25519-sign, write immutable certificate | new |
| `schedule.tick` | every 30s; read due schedules via `cron-parser` (stored IANA tz, DST-correct); enqueue `run.execute` | broken `setInterval` scheduler + vapor `schedules/execute` |
| `webhook.deliver` | HMAC-signed POST via safeFetch; queue-backoff retries; idempotent on `(webhook_id,event,job_id)` | inline double-fetch |

### Fairness, retries, idempotency, recovery, cancellation

- **Per-org fairness, portably:** a transactional `org_inflight` counter (incremented on claim, decremented on terminal); the claim filters `org_id NOT IN (SELECT org_id FROM org_inflight WHERE inflight >= perOrgCap)` — identical SQL on both engines, not a correlated subquery. Separate claim statements for runs (priority 0) and webhooks/imports (priority 10) so a retry storm cannot starve runs.
- **Retries:** `attempts++`, backoff `min(2^attempts·5s, 5min) + jitter`; `attempts>=max` → `dead` (re-drivable). Non-retryable (config 4xx, SSRF block, decrypt failure) → immediate `dead`.
- **Idempotency:** partial-unique `(org_id,dedup_key)` + `ON CONFLICT DO NOTHING`; handlers upsert; `cert.sign` is content-addressed.
- **Crash recovery:** `reapStale` resets stale `claimed|running` to `queued` WITHOUT burning a retry, decrements `org_inflight`.
- **Cancellation/timeout:** `requestCancel` sets the flag returned by heartbeat; handlers abort cooperatively. Every job carries `deadline_at`; the reaper fails past-deadline jobs — no zombies.

### Live progress — polling default, denormalized counters

`GET /api/runs/[id]/progress` returns `{status, completed, total, passCount, failCount, partialCount, needsHumanCount, etag}`. **The worker denormalizes these counters onto the `runs` row** as it writes each result, so the endpoint is a single indexed PK read — never a `COUNT(*)` over `run_results`. SWR polls at 2.5s ± 20% jitter while running, stops on terminal and on tab blur, sends `If-None-Match` for cheap `304`s. Optional SSE (`/runs/[id]/stream`) is a best-effort UI enhancement that polls the `run_events` tail with a 25s reconnect cap; it degrades to polling. SDKs use polling only.

---

## API, SDK & Integrations

### REST contract (`/api/v1/*`)

URL-prefix is the single versioning axis (breaking → `/api/v2/`); `EvalDesk-Version` is informational only. Internal session-only dashboards/billing stay at `/api/*`, out of contract. Resources (org-scoped): `projects`, `projects/{id}/test-cases`, `test-cases/{id}`, `runs`, `runs/{id}`, `runs/{id}/results`, `results/{id}/verdicts`, `certificates/{id}`, `webhooks`, `imports`, `api-keys`.

**Auth — org always explicit.** `resolveAuth(req): {userId, orgId, role, scopes, source}`. Machine: `Authorization: Bearer evaldesk_live_…` (SHA-256 lookup; org comes off the key row). Session: `X-EvalDesk-Org` validated against memberships, or the sole org if unambiguous, else `400 org_required`. Org is never inferred from the resource — that anti-pattern reintroduces IDOR.

**Pagination.** Cursor = `base64url(JSON{k:[createdAtMs,id], o:orgId, r:resource})`; the server rejects cursors whose org/resource mismatch the caller. Order by `(created_at, id)` with CUID2 id as a collision-free tiebreaker, `created_at` as epoch-ms so SQLite/PG sort identically. Lists return `{data, page:{next_cursor, has_more, limit}}`.

**Errors (RFC 9457 + `code` extension).** Stable machine codes (`run_not_found`, `agent_endpoint_blocked`, `quota_exceeded`, `org_required`, `missing_scope`, `idempotency_conflict`, …). Cross-org → `404`.

**Async run.** `POST /api/v1/runs`: verify project under `ctx.orgId`; honor `Idempotency-Key` (unique `(orgId,key)` on `runs` — CI retries never duplicate runs or burn BYO tokens); SSRF-check the endpoint (`422 agent_endpoint_blocked`); insert `runs` + a `jobs` row; return `202`. `executeRun` is removed from the request path. Completion is learned by polling `GET /runs/{id}`. Legacy `/api/run` + `/api/ci/run` stay 90 days behind `Deprecation`/`Sunset` headers, internally enqueuing but returning the legacy synchronous shape, then `410`.

### SDKs (Python + TS/TS)

`EvalDesk(base_url, api_key, org=None)` → `.projects`, `.test_cases`, `.runs`, `.certificates`, `.imports`, `.webhooks`. The current client-side-filtering `get_run` is replaced by real `GET /v1/runs/{id}`. Async-aware: `run = client.runs.create(...)` returns at `202`; `run.wait(timeout, poll)` polls until terminal. DeepEval-parity gate:

```python
from evaldesk import EvalDesk, assert_run_passes
run = EvalDesk().runs.create(project_id="…").wait()
assert_run_passes(run, min_pass_rate=0.8, max_regressions=0)   # AssertionError → pytest fails
```

problem+json maps to typed exceptions (`RunFailed`, `RunTimeout`, `QuotaExceeded`, `EndpointBlocked`). Pagination via auto-iterating generators following `next_cursor`. SDKs use polling, never SSE.

### GitHub Action (Node20)

The current Bash action reads `passCount`/`passRate` that `ci/run` returns as null — functionally broken. Rewritten as a Node20 action bundled from the TS SDK (a CI freshness check fails on stale `dist/`). It enqueues via `/api/v1/runs` (`Idempotency-Key = run_id-run_attempt`), polls, renders Markdown to `$GITHUB_STEP_SUMMARY`, posts a sticky PR comment, sets outputs, and exits non-zero when `pass_rate < threshold` OR `regressions > max`. Regression decision reuses server-side `regression-gate.ts`. **No-baseline → informational pass** (gate on pass-rate only) so first runs never false-fail.

### Webhooks

HMAC-SHA256 over `"{timestamp}.{body}"`, header `EvalDesk-Signature: t=,v1=` (Stripe-style, 5-min replay tolerance), secret encrypted at rest. Delivery is a `jobs` row processed with exponential backoff (1m,5m,30m,2h,6h; max 5), each attempt appended to `webhook_deliveries`. SSRF-checked at registration and each delivery, redirects disabled. Events: `run.completed`, `run.failed`, `regression.detected`, `certificate.signed`, `verdict.submitted`.

### Evals import (`POST /api/v1/imports`)

Replaces the zero-auth `test-cases/bulk`. Registry `src/lib/import/adapters/{deepeval,openai_evals,langfuse}.ts`, each `detect(raw)` + `parse(raw)` → normalized test cases. OpenAI-Evals `detect()` is conservative and raises explicit `unsupported_sample_shape` with line numbers rather than mis-mapping. Project verified under `ctx.orgId` (`404` otherwise); 5 MB / 5,000-item cap (`413`); >500 items enqueues as `import.process` (`202`).

---

## Frontend & UX

### Design system

Adopt **shadcn/ui** (copy-in) into `src/components/ui/`, mapping the brand palette (`#ABC83A` lime, etc.) into the already-declared-but-undefined Tailwind CSS-variable contract (`--primary`, `--card`, `--ring`, `--chart-1..5`). The ad-hoc `.btn-*`/`.input`/`.card` classes in `globals.css` are deleted. Raw hex literals across **86 files** are migrated via a codemod + a CI ESLint rule banning raw hex in dashboard components — a strangler, not a big-bang rewrite, with a Storybook + Playwright visual baseline established first. Add deps: `swr`, CVA, Radix, `react-resizable-panels`, `@tanstack/react-table`, `@tanstack/react-virtual`. Shared verdict vocabulary: `VerdictBadge` (color **+ icon + text**, never color-only), `KappaBadge`, `CalibrationBadge`, `NeedsHumanReason`.

### Data fetching — server-first

The all-client `fetch-into-useState` model is replaced. Default to **RSC** reading via two explicit contracts: `src/lib/auth/server.ts` (`getSession`/`requireOrgServer` reading `next/headers cookies()`) and `src/lib/repositories/*` org-scoped reads taking `orgId` as a **non-optional typed arg** (compile-time IDOR guard). Client components are islands for interaction/live data only. **One mutation surface:** all writes go through the versioned `/api/*` contract (same surface as SDK/CI); server actions are thin wrappers over the same route logic, never reimplementing auth/signing/audit.

### The core rating experience — `ReviewWorkspace`

Full-screen `(/dashboard)/review/[queueId]`. Side-by-side question/answer via resizable panels; collapsible tool-call/citation/RAG disclosures; the header surfaces **why** the item is queued (low confidence / disagreement) via `NeedsHumanReason`. Queue list virtualized for thousand-item doctor sessions. Keyboard-first (`1/2/3` verdict, `Enter` submit+advance, `b` blind, `?` legend) with `1/2/3` **suppressed inside the rationale textarea**. **Confirmed-advance, idempotent submit:** each submit POSTs one verdict row with a client `attemptId` (unique on `(resultId,reviewerId,attemptId)`); the cursor advances only after the server confirms; the UI never UPDATEs a verdict — corrections append a versioned row.

### Blind review — server-enforced, not DOM-hidden

For a blind queue, the API **omits the AI-judge verdict and all peer verdict rows from the serialized payload entirely** — never sent, not in the SWR cache, not retrievable via devtools. After the reviewer submits, a follow-up fetch may reveal the comparison. The signed `blindMode:true` is therefore a true statement about the bytes the reviewer saw. A contract test asserts the blind payload shape contains no judge/peer fields (a DOM test cannot prove absence).

### Dashboards

Recharts wrapped in `<ChartCard>` off `--chart-*` tokens. Pass-rate trend with regression annotations, worst-cases table, regressions (DiffViewer). **`CalibrationPanel`** (AI-vs-human agreement over time + confusion heatmap + per-criterion gap) and **`AgreementPanel`** (Cohen's/Fleiss kappa per dataset/run with Landis-Koch bands + reviewer-pair matrix) are **headline cards** — they are what no incumbent renders. All values are precomputed by the worker into driver-neutral tables; the frontend reads finished rows, never aggregates raw verdicts client-side (would not scale, would leak blind data).

### Onboarding & sign-off

Two personas by invited role. **Builder:** connect endpoint → import/generate cases → run → see scores. **Invited expert (zero-code):** lands directly in a pre-seeded `ReviewWorkspace` with a 3-step coachmark; never sees endpoint config or keys (RBAC, not hidden UI). **Sign-off:** the Sign & Certify dialog shows the canonical summary (dataset version, judge model + prompt hash, every verdict + reviewer credential, kappa, calibration gap) derived from the *same canonical JSON the bytes are signed over*, then calls the audit signing service — the UI never constructs the signature. The certificate page offers **zero-egress offline verification**: the signed JSON bundles the instance public key; verify via a local CLI (`npx evaldesk verify cert.json`) or in-browser WASM, never a callout to evaldesk.dev.

---

## Moat Features

These five features ARE the business. None of DeepEval, Langfuse, Braintrust, Phoenix, or Confident AI ship them. All math lives under `src/lib/moat/` as pure, dependency-injected functions with zero DB/crypto-IO imports; thin worker/route adapters do all IO.

1. **Inter-rater reliability (kappa).** Append-only `human_ratings` (one row per reviewer per result) replaces the single mutable `humanRating`. `cohenKappa`/`fleissKappa`/`weightedKappa` with frozen method + weighting scheme copied into the certificate. Reviewer attribution is an **honest server attestation** bound to the authenticated reviewer + frozen credential snapshot — reviewers are browser seats with no keypair; per-reviewer WebCrypto signing is optional commercial hardening. *Why hard to copy:* requires the shared-rubric label scale, the per-reviewer append-only model, and credential snapshots — all structural, all absent everywhere else.

2. **Judge calibration + closed routing loop.** Disagreement = vote-entropy across *distinct* judge models (not the legacy two-identical-models majority fraction). Confidence is *computed*, never model-emitted. τ is learned only from a mandatory 5% random audit sample (no selection-bias circularity); published only past cold-start gates. *Why hard to copy:* Confident AI "aligns" experts to metrics but never quantifies the gap; the audit-sample design is the only statistically valid estimator and is a deliberate product decision.

3. **Sign-off / approval workflow.** `signoff_policies` (min reviewers, required role, verified-credential gate, kappa gate) + append-only `run_signoffs`. On quorum the `finalize-and-sign` worker locks the run (immutable), signs the certificate, and appends a hash-chained audit event; post-lock mutations return `409`. Corrections create a new run version, never UPDATE.

4. **Immutable audit + signed compliance artifact.** Hash-chained `audit_event` sealed by a single per-org worker (no hot lock). `buildCertificatePayload` constructs a **backend-agnostic value object** (epoch-ms ints, `toFixed(6)` reals, nulls omitted) canonicalized via hand-rolled **RFC 8785 JCS** (not `JSON.stringify`), SHA-256'd, Ed25519-signed with the per-instance key. **The artifact of record is the signed canonical JSON, not the PDF** — no headless Chromium (it would break one-docker self-host). The HTML report embeds the `canonicalJsonBlob` in a `<script type="application/json">` block so the downloaded file is itself offline-verifiable; PDF export is optional/commercial. Key rotation is first-class (`/.well-known/evaldesk-signing-keys.json` serves all public keys); `npx evaldesk-verify cert.json` verifies offline with zero callback. *Why hard to copy:* no competitor produces a signed, offline-verifiable record at all; doing it correctly (canonical JSON determinism across two DB engines, crypto-shred-compatible) is deep work.

5. **Pluggable compliance suites (HIPAA / RBI / EU-AI-Act).** The MIT engine loads/runs suites; content packs are commercial npm packages (`@evaldesk/suite-hipaa`). A suite is a versioned manifest mapping `controls → testPacks/rubric/required-signoff`. A suite-scoped run produces a control-coverage matrix flowing into the signed artifact. **The open-core boundary is CI-enforced** by a `dependency-cruiser` rule + an isolated tsconfig project + a MIT-only build job (commercial registry disabled). *Why hard to copy:* the regulated-domain modules plus residency plus the signed artifact in one product is the combination none of the five hold.

---

## Testing & Quality Strategy

Today there are **zero tests** and the code is structurally untestable (judge imports the `db` singleton and hardcodes a `fetch`). The **testability refactor is a first, blocking deliverable**: dependency-inject `{provider, db, clock}` into every eval-path lib; the provider seam is the only place allowed to `fetch` an LLM host; a custom lint rule fails the build on raw `fetch(`, `process.env.OPENAI_API_KEY`, or `@/db` imports in eval-path files, and on `Date.now`/`new Date()` in sign/eval paths.

**Toolchain:** Vitest + v8 coverage; Playwright e2e; `@testcontainers/postgresql` for PG, SQLite via tmpfile (never `:memory:` for queue tests); MSW as a deny-net backstop.

**Pyramid.**
- **Unit (~65%, all I/O mocked):** pure libs (`calibration`, `kappa`, `canonicalize`, `sign/verify`, `ssrf-guard`, `crypto`) and judge libs feeding a `FakeProvider` a cassette, asserting both the parsed result and the exact captured DB write.
- **Integration (~30%), split by dependency:** authz/RBAC/session/SSRF run ONCE on SQLite (driver-independent, fast); data-shape/ordering/float/queue run on BOTH via `eachDriver` with an **equal-results parity assertion** — the real dual-driver guard (catches SQLite case-insensitive LIKE vs PG, float ordering, epoch-int vs timestamptz, 0/1 vs boolean) that "migrations apply to both" cannot.
- **E2E (~5%, wedge gates):** three golden journeys made deterministic by a synchronous `tickWorker()` + `pollUntil` (no `sleep`): onboarding; async run → judge → low-confidence routes to human → two reviewers sign → kappa shown; finalize → signed cert → `npx evaldesk verify` passes offline.

**Gates beyond coverage.** Global 80% lines/branches, 90% on crypto/calibration/sign/ssrf/providers. **For security-critical code the gate is a fixed must-pass attack/golden corpus, not a number**, with a meta-test asserting the corpus never shrinks:
- **IDOR/authz matrix** per HTTP method × {no-session, other-org, wrong-role, owner}, cross-org probes seeded with a victim org's real row id against *every mutating verb* — catches SELECT-scoped-but-DELETE-unscoped IDOR. A meta-test fails CI if any `route.ts` is missing from the registry.
- **SSRF** corpus: metadata IP, loopback, private ranges, IPv6, decimal/hex/octal encodings, DNS-rebind via stub resolver, redirect-to-internal — assert no socket attempt via a connect-spy.
- **Crypto:** GCM round-trip, wrong-KEK fails closed, KEK-rotation re-wrap, and the plaintext-upgrade migration for existing self-host rows.
- **Audit:** tamper a finalized row → hash chain detects; offline cert verify fails on a flipped byte.
- **Zero-egress:** `denyAllEgress(allow:[localAgent, fakeProvider])`, then a full eval+judge+sign completes — proving no callout to evaldesk.dev.
- **Reproducible cert:** a committed `golden-certificate.json` re-derived and **byte-compared across BOTH drivers and the Node matrix**.
- **Queue:** exactly-once-under-contention, crash/lease reclaim, dead-lettering — tested on both drivers.
- **Wedge math:** kappa anchored to published worked examples including the kappa-paradox and degenerate cases (defined sentinels, not `NaN`).

**Per-feature Definition of Done (CI-enforced `dod-check`):** implement *one* feature, then in the same PR ship (1) unit tests with golden values for math/crypto, (2) integration per HTTP method covering 401/403/404/400/200, (3) an authz-registry entry, (4) `eachDriver` coverage if it touches SQL shape/ordering/queue, (5) e2e touch if a golden journey changes, (6) coverage ≥ threshold, (7) clean typecheck/lint, (8) a named entry in the relevant attack corpus. No merge otherwise. Verify fully, then move to the next feature.

**CI:** `typecheck`+`lint` → `unit` → parallel `authz` (SQLite) ∥ `security` ∥ `integration-pg` (sharded) ∥ `integration-sqlite` (sharded) with a `driver-parity` assertion → `build` → `e2e` (built app+worker against Postgres, deterministic tick). Every commit also runs the **one-docker-command self-host smoke test**: `docker compose up`, then a full eval+sign with **egress denied** — protecting the headline self-host + residency promise continuously. A watched nightly `llm-record-drift` job re-records cassettes with a real key for deliberate model-drift review.

---

## Open-Core Boundary

| Capability | MIT (free, self-host complete) | Commercial |
|---|---|---|
| Eval engine, provider abstraction (OpenAI/Anthropic/OpenRouter/Ollama, BYO key) | ✅ | |
| Async runs, Postgres/SQLite queue, worker | ✅ | |
| Human review, multi-reviewer verdicts, Cohen's/Fleiss kappa | ✅ | |
| AI-vs-human calibration + closed routing loop | ✅ | |
| Signed certificates, hash-chained audit log, offline verify CLI/WASM | ✅ | |
| SQLite + Postgres, one-docker-command self-host, zero-egress core | ✅ | |
| Python + TS SDKs, GitHub Action, REST API, webhooks, evals import | ✅ | |
| SSO / SCIM | | ✅ |
| Hosted multi-tenant cloud | | ✅ |
| Prebuilt compliance suites (HIPAA / RBI / EU-AI-Act npm packages) | | ✅ |
| Advanced analytics, hosted PDF render service | | ✅ |
| Support / SLA | | ✅ |

The boundary is enforced, not documented: the suite engine references only a local zod manifest schema; a `dependency-cruiser` CI rule forbids any `@evaldesk/suite-*` import into `src/`; and a CI job builds with the commercial registry disabled and runs a full eval. The open core never hard-depends on closed code.

---

## Reuse Map

**KEEP as-is (pure, testable):** `cost-tracker.ts`, `regression-gate.ts`, `tool-call-parser.ts`, `golden-set.ts`, `embed-badge.ts`, `judge-templates.ts` (domain rubrics — strong for the regulated wedge), `utils.ts`, `slack-notifier.ts`, `pdf-report.ts` HTML generator, bcrypt `signup`/`login`, `roles.ts` (now actually wired), `api-keys.ts` SHA-256 hashing (add org scoping), billing scaffolding (`billing.ts`, Stripe gated by `isStripeConfigured`), marketing routes (`blog/*`, `contact`, `embed/badge`).

**REFACTOR (logic real, needs provider interface + org scoping + DB injection):** `schema.ts` (re-author Postgres-first with shared column-builder, add org/jobs/calibration/verdict tables), the 8 OpenAI-coupled AI libs (`judge`, `multi-judge`, `rag-evaluator`, `safety-scorer`, `citation-checker`, `comparison-evaluator`, `adversarial-generator` — route through providers, inject DB, dedupe `callOpenAI`), `api-utils.ts` `requireAuth` → `requireMember`/`loadInOrg`, most of the ~79 routes (add org+ownership), `production-miner.ts` (keep as a utility, not "mining"), `multi-turn-runner.ts` (fold into unified runner, kill the inline `require` and `conversationId==="multi-turn"` sentinel).

**REBUILD:** `db/index.ts` (driver interface + Drizzle migrations; the Proxy survives), `auth.ts` (signed sessions), `middleware.ts` (presence gate, kill the `includes(".")` bypass), `agent-runner.ts` (worker task + SSRF guard; `updateRunStats` arithmetic kept but re-sourced from verdicts), `scheduler.ts` (→ jobs cron tick), `streaming-runner.ts` (real SSE read-through or gone).

**DELETE:** `loginOrCreate` (passwordless backdoor), the empty `lib/analytics/` directory (while `/api/analytics/*` routes reference it), vapor `schedules/execute` (creates runs it never executes), the fake one-token streaming path, the `agent-runner` `data.x||…||JSON.stringify(data)` fallback, the legacy `DEFAULT_MODELS` two-identical-models multi-judge, plaintext `projects.agentApiKey`/`agentHeaders` columns, mutable `runResults.humanRating`/`ratedBy`.

**Critical gap:** the calibration/kappa "signed auditable record" — the product's actual wedge — does not exist in code today and is built net-new under `src/lib/moat/`.

---

## Phased, Test-Gated Build Roadmap

Each phase must pass its verification gate before the next begins. **Implement one feature, test and verify it fully, then move on.**

### Phase 0 — Testability & dual-driver foundation
- DI `{provider, db, clock}` into eval-path libs; provider seam; the eval-path lint rule.
- `src/db/spec.ts` + codegen → `schema.pg.ts`/`schema.sqlite.ts`; rebuild `db/index.ts` behind the driver interface; Drizzle migrations replace `initTables()`; repos layer scaffold.
- **Gate:** `eachDriver` parity harness green on both engines; the lint rule fails a planted raw-`fetch`; codegen-drift CI check passes.

### Phase 1 — Security & multi-tenancy foundation
- `organizations`/`memberships`; `org_id` on every table; signed sessions; `middleware` presence gate; `requireMember`/`loadInOrg`/`loadChildInOrg`; RBAC wired; envelope encryption + plaintext-upgrade migration; SSRF `safe-fetch`; hash-chained audit inbox + sealer; seed/Stripe/rate-limit fixes.
- **Gate:** the IDOR/authz matrix (per-method, cross-org, every verb) is green and the registry meta-test passes (no unguarded route); SSRF + crypto corpora green; `verifyChain` passes.

### Phase 2 — Async core loop
- `jobs` queue + two adapters; worker process (DI'd handlers); `run.execute` + SSRF'd runner; progress counters denormalized; `202` run API; polling; cron tick; deprecation shims on legacy routes.
- **Gate:** exactly-once/crash-reclaim/dead-letter queue tests on both drivers; e2e async run → results visible via polling; zero-egress smoke test green.

### Phase 3 — AI subsystem & the wedge math
- Provider adapters; `JudgeEngine`/`JudgeEnsemble` (distinct-model dedupe, ordinal disagreement, honest confidence); budget gate; `ai_scores` immutable + idempotent persistence; `kappa.ts`/`calibration.ts` (audit-sample τ, cold-start gates); `agreement_metrics`/`judge_calibration` tables; `calibration.recompute` worker.
- **Gate:** kappa golden fixtures (incl. paradox + degenerate sentinels); audit-sample-vs-full-population bias-correction test; needs-human routing table test; cold-start `published=false` test.

### Phase 4 — Review experience & sign-off (MVP wedge UI)
- `ReviewWorkspace` (keyboard-first, virtualized, server-enforced blind); append-only `human_ratings` with idempotent submit; `review.settled`/adjudication; `signoff_policies`/`run_signoffs`; `finalize-and-sign` + Ed25519 certificates; RFC 8785 canonicalization; offline verify CLI/WASM; `CalibrationPanel`/`AgreementPanel`.
- **Gate:** blind-payload contract test (no judge/peer fields); reproducible `golden-certificate.json` byte-identical across both drivers + Node matrix; locked-run `409` integration test; e2e finalize → offline verify passes.

> ### ── OPEN-SOURCE MVP CUT LINE ──
> Phases 0–4 ship the complete MIT product: secure multi-tenant, dual-driver, async eval engine with AI judging, expert review, kappa + calibration, signed offline-verifiable certificates, one-docker self-host, zero-egress. This is everything the wedge requires and everything no incumbent has in one product. **Ship and get design partners here.**

### Phase 5 — Integrations & developer surface
- `/api/v1/*` REST contract (handler factory, cursor pagination, problem+json); Python + TS SDKs with `run.wait()` and pytest-style gate; Node20 GitHub Action; signed webhooks with queue retries; evals import adapters.
- **Gate:** SDK contract tests (both languages, recorded mock server); Action e2e (non-zero on injected regression, clean pass on baseline-less project); webhook signature/replay + worker-fairness tests; import auth/size/rollback tests.

### Phase 6 — Commercial / compliance suites
- Suite engine + manifest schema; `@evaldesk/suite-hipaa` (and RBI/EU-AI-Act) packs; control-coverage matrix into the artifact; SSO/SCIM; hosted PDF render.
- **Gate:** MIT-only build job (commercial registry disabled) compiles + runs a full eval; `dependency-cruiser` boundary test fails on a planted commercial import; suite fixture e2e (load → seed → run → coverage → certificate cites controls).

---

## Open Questions / Decisions Needed from the Founder

1. **Reviewer non-repudiation.** The default is honest *instance* attestation (the server attests an authenticated reviewer submitted a verdict), not per-reviewer keys. Do any target buyers (regulators) demand non-repudiation *against the host* — i.e. the optional per-reviewer WebCrypto signing mode — at MVP, or can it stay a commercial flag?

2. **Confidence threshold defaults (τ_dis, τ_conf, audit %).** Defaults (0.34 / 0.6 / 5%) are guesses that need empirical tuning per domain or the human queue floods/starves. Do we ship them as documented per-project tunables and tune with the first health-tech design partner, or block MVP on a calibration study?

3. **Self-host LLM parity disclosure.** Ollama lacks JSON mode and has weaker embeddings, so self-host eval quality trails cloud. Confirm we disclose this in a capability matrix rather than chase parity — and whether a recommended local model list ships with v1.

4. **Credential verification.** `reviewer_credentials.verified_by`/`verified_at` exist, but *who* verifies a doctor's license and *how* (manual admin, third-party API)? At MVP, is `credentialVerified=false` (recorded but flagged) acceptable, with verified-credential signoff gates as a later/commercial feature?

5. **KEK custody for hosted cloud.** Key loss is unrecoverable by design (operator escrow on self-host). For the hosted commercial offering, do we hold per-tenant KEKs (operational simplicity, but we can technically decrypt) or offer customer-managed keys (KMS/HSM) as a compliance upsell — and does that affect the MVP secrets schema?

6. **Data retention defaults.** Crypto-shredding and soft-archive are built; the *default* retention window and whether erasure is self-serve vs support-gated are policy decisions a regulated buyer will ask about on day one.

7. **Legacy data.** Any design partners with existing SQLite data who need `scripts/import-legacy.ts`, or do we discard drifted pre-launch DBs and start clean on the `0000_baseline` migration?
