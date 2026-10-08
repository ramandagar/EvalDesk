# Changelog

All notable changes to EvalDesk are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] — 2026-10-08

### Added
- **Multi-Model Judge Ensembles** — Native evaluation support across Anthropic Claude, OpenAI GPT-4o, DeepSeek, Google Gemini, and local Ollama/vLLM endpoints with weighted rubric consensus.
- **Ed25519 Cryptographic Certificates** — RFC 8785 JCS-canonicalized evaluation certificates with offline signature verification CLI (`npx evaldesk verify`).
- **Official Python SDK (`evaldesk`)** — PyPI package with CI/CD assertion gates (`assert_run_passes`), streaming run handles, and pytest fixtures.

### Changed
- Automated schema codegen and dual-driver parity between PostgreSQL (production) and SQLite (local dev).
- Improved session token validation and sticky sidebar navigation across marketing & docs pages.

---

## [0.7.0] — 2026-09-18

### Added
- **Automated Compliance Packs** — Full regulatory mapping for HIPAA Security Rule (45 CFR § 164.312) and EU AI Act (Articles 9–15).
- **RAG Faithfulness Scoring** — Context-grounded hallucination detection verifying factual claims against retrieved reference documents.
- **Adversarial Red-Team Safety Probes** — Automated generation of jailbreaks, prompt injections, and PII/PHI leakage test vectors via `POST /api/v1/projects/:id/probes`.

### Improved
- Inter-rater agreement engine calculating Cohen's and Fleiss' Kappa across multi-judge ensembles.
- Database query indexing on run results for sub-second report generation on 10,000+ case runs.

---

## [0.6.0] — 2026-08-21

### Added
- **Human-in-the-Loop Review Workspace** — Server-enforced blind dual-annotation with keyboard-first navigation (1/2/3 + Enter).
- **Real-time Latency & Streaming Evaluation** — Token-level timing metrics including Time-To-First-Token (TTFT) and throughput tracking.

### Fixed
- Fixed SSE connection dropouts during long-running batch evaluation runs.
- Reduced memory overhead for high-concurrency batch execution workers.

---

## [0.5.0] — 2026-07-24

### Added
- **Domain Benchmark Packs** — Prebuilt Medical Triage and Clinical Decision benchmark test suites with standard clinical triage protocols.
- **Custom Evaluation Rubrics** — Weighted scoring criteria with markdown rubric guidelines and pass/fail thresholds.
- **Webhook Delivery System** — HMAC-signed webhooks for `run.completed`, `run.failed`, and `certificate.signed` events.

### Improved
- Tamper-evident audit log trail with immutable SHA-256 event chaining.

---

## [0.4.0] — 2026-06-19

### Added
- **Agent Tool Call Validation** — Automatic verification of function invocations and parameters against JSON Schema definitions.
- **Semantic Similarity Judge** — Embedding-based cross-encoder similarity scoring for non-exact agent outputs.
- **Role-Based Access Control (RBAC)** — Granular permissions across Owner, Admin, Reviewer, and Viewer roles.

### Improved
- Modern dark/light theme support with accessible contrast ratios.

---

## [0.3.0] — 2026-05-15

### Added
- **Multi-Model Judge Consensus** — Majority voting and weighted agreement scoring across distinct LLM judges.
- **Safety Scoring** — Automated detection of toxicity, hate speech, and sensitive data leakage.
- **Citation Verification** — Source-grounding verification for retrieval-augmented generation agents.

### Improved
- Parallel agent HTTP calling with connection pooling and configurable rate limits.

---

## [0.2.0] — 2026-04-18

### Added
- **Multi-Turn Conversation Testing** — Stateful dialogue branching and context retention evaluation.
- **Cron Scheduling** — Automated recurring evaluation runs with cron expressions.
- **Domain Criteria Templates** — Pre-configured evaluation rubrics for clinical, financial, and legal domains.

---

## [0.1.0] — 2026-03-15

### Added
- Initial open-source release of EvalDesk core evaluation engine.
- LLM-powered judge with customizable criteria and scoring rubrics.
- Test case management with categories, tags, and bulk CSV/JSON import.
- Run history with pass/fail analytics and latency breakdowns.
- Project-based team organization and scoped API key authentication.
