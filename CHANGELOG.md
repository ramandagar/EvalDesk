# Changelog

All notable changes to EvalDesk are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Public no-signup demo path (`/demo`) with a pre-loaded sample project
- Multi-model judge ensemble run live (currently single-judge in production)
- Playwright UI test baseline
- Production monitoring/alerting guidance

## [0.1.0] — 2026-06-28

The first open-source release: the complete expert-verified evaluation engine,
self-hostable, with the signed-certificate wedge.

### Added — Core eval loop
- **Projects** — connect any HTTP agent endpoint (OpenAI-compatible, LangChain, custom); AES-256-GCM-encrypted API keys (never returned to the client)
- **Test cases** — plain-English input + expected output, per-project categories
- **Evals import** — DeepEval, Langfuse, and OpenAI-Evals dataset adapters with conservative format detection and line-numbered errors
- **Runs** — async execution via a Postgres/SQLite-backed job queue (CAS claiming, retry with backoff, stale-job reaper, graceful shutdown)
- **Run reports** — per-case agent answer + AI score + human verdict + final label; downloadable as self-verifiable HTML, CSV, or JSON

### Added — The AI subsystem
- **Provider abstraction** — DeepSeek, OpenAI, OpenRouter, Ollama (OpenAI-compatible), bring-your-own-key
- **Judge ensemble** — distinct-model dedupe, ordinal disagreement scoring, honest empirical confidence (self-consistency + cross-judge agreement)
- **Closed needs-human routing** — uncertain, disagreeing, audit-sampled, and adversarial items route to human review

### Added — The wedge (agreement & calibration)
- **Inter-rater agreement** — Cohen's κ, Fleiss' κ, weighted κ, bootstrap confidence intervals, Landis–Koch bands — golden-anchored to published worked examples
- **Judge calibration** — AI-vs-human gap, directional bias, audit-sampled auto-finalize threshold τ with cold-start gates

### Added — Human review & sign-off
- **Review workspace** — keyboard-first (1/2/3 + Enter), virtualized, **server-enforced blind review** (AI/peer verdicts are omitted from the payload, not DOM-hidden)
- **Append-only human verdicts** — idempotent submission, correction chain, partial-unique "one current verdict per reviewer"
- **Adjudication** — human-wins consensus; the AI never overrides a human verdict
- **Sign-off workflow** — configurable quorum, role gate, optional κ gate; last-owner guard

### Added — Signed compliance artifact
- **Ed25519-signed certificates** — RFC 8785 JCS canonicalization (byte-reproducible), run locking (post-sign immutability)
- **Offline verification** — `node scripts/verify-cert.mjs cert.json` (zero-dependency, zero-egress); cross-implementation parity tested against the server
- **Control-coverage** — compliance suites' coverage flows into the signed certificate

### Added — Security & multi-tenancy
- **Structural IDOR prevention** — every table `org_id`-scoped; cross-tenant access returns `404` (no enumeration); enforced by a per-route attack matrix with a CI meta-test
- **Auth** — opaque session tokens (hash-stored) **and** machine API keys (Bearer, SHA-256-hashed, scoped)
- **RBAC** — owner / admin / reviewer / viewer, enforced at the guard
- **Envelope encryption** with AAD binding; **SSRF guard** with connect-time IP pinning on all outbound calls
- **Rate limiting** — fixed-window, fail-closed on auth endpoints
- **Password reset** — single-use, expiring, hash-stored tokens (email via console or SMTP)
- **Tamper-evident audit log** — hash-chained event records on key mutations

### Added — Developer surface
- **TypeScript SDK** — `runs.create().wait()`, `assertRunPasses({ minPassRate })`
- **GitHub Action** — gate CI on pass-rate / regressions
- **Webhooks** — HMAC-signed (Stripe-style), SSRF-guarded delivery with queue-backed retries
- **Versioned REST API** (`/api/v1`) with cursor pagination and problem+json errors

### Added — Operational
- `/api/health` endpoint, standalone worker entrypoint, advisory-locked Postgres migrations
- Dual-driver codegen with a CI drift guard (single spec → Postgres + SQLite schemas)

### Known limitations
- Email defaults to console logging (SMTP requires `EVALDESK_SMTP_URL` + `nodemailer`)
- No automated browser tests yet (pages are build-verified + click-smoke-tested)
- Multi-model judge ensemble is unit-tested but runs single-judge in production
- `next start` prints a warning under `output: standalone`; use `npm run dev` or `node .next/standalone/server.js`

[Unreleased]: https://github.com/ramandagar/EvalDesk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ramandagar/EvalDesk/releases/tag/v0.1.0
