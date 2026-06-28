# Contributing to EvalDesk

Thanks for your interest in improving EvalDesk — an open-source, expert-verified evaluation platform for AI agents. We welcome contributions of all sizes.

## Code of Conduct

Be respectful and constructive. We're building tooling for regulated, high-stakes domains (healthcare, legal, finance), so accuracy and honesty matter as much as code quality.

## Getting started

```bash
git clone https://github.com/ramandagar/EvalDesk.git
cd EvalDesk
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                   # http://localhost:3000
```

You'll need:
- Node.js 18+
- A database — SQLite (default, zero-config, file at `./data/evaldesk.db`) or Postgres (`DB_DRIVER=postgres` + `DATABASE_URL`)
- An `EVALDESK_ENCRYPTION_KEYS` / `EVALDESK_ACTIVE_KEY_ID` pair (generate with `openssl rand -base64 32`)
- An optional LLM key (`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, etc.) for the AI judge

## The architecture matters

Before changing anything non-trivial, please read [`ARCHITECTURE.md`](./ARCHITECTURE.md). A few principles are **non-negotiable** — a PR that violates them will be sent back:

1. **Security is structural.** Every domain row carries `org_id`; every query filters by it. Cross-tenant access returns `404`, never `403`. Never read `org_id` from request input — always from the authenticated context. Don't add a route that bypasses the `requireMember` guard.
2. **Thin routes, fat services.** Route handlers do four things: authenticate, validate (zod), load in-org, call an injected service. Don't import `@/db` or call `fetch` from a route.
3. **The AI is a suggestion, never a verdict.** AI scores write only to the immutable `ai_scores` layer. The AI never overwrites a human verdict.
4. **Dual-driver, one codebase.** No `pgvector`, no array columns, no JSONB operators, no dialect date functions in shared paths. Timestamps are epoch-ms integers on both engines.
5. **Async by default.** No LLM I/O or run execution on the request thread. Enqueue and return.

These are enforced by CI guards (`npm run check:eval-path`, `npm run check:open-core`) and tests — if your change fails one, that's the system telling you something.

## Development workflow

```bash
npm run typecheck        # tsc --noEmit, must be clean
npm test                 # Vitest — runs on SQLite by default
npm run check:eval-path  # eval-path purity guard
npm run check:open-core  # open-core boundary guard
npm run db:gen           # regenerate schemas from the spec (commit any diff)
```

### Database changes

The schema's single source of truth is [`scripts/db-spec.mjs`](./scripts/db-spec.mjs) — a typeless table descriptor. **Never edit `schema.pg.ts` or `schema.sqlite.ts` by hand.** Instead:

1. Edit `scripts/db-spec.mjs`.
2. Run `npm run db:gen` (regenerates both schema modules).
3. Run `npx drizzle-kit generate --config drizzle.config.sqlite.ts` and `--config drizzle.config.pg.ts` to emit migrations for both engines.
4. Commit the spec, both schemas, and both migrations.

The drift guard fails CI if the committed schemas don't match a regen.

### Testing

- Pure logic (kappa, calibration, canonicalization, signing) gets **golden-value unit tests** anchored to published examples.
- Anything touching SQL shape/ordering/queue runs on **both** engines — set `TEST_DATABASE_URL` to run the Postgres parity variants.
- Security code is gated by **attack corpora** (the IDOR matrix, SSRF corpus, crypto round-trips), not coverage percentages.
- Every new `/api/v1` route must be added to the IDOR attack matrix in `src/lib/http/__tests__/idor-matrix.test.ts` — a meta-test fails CI otherwise.

## Submitting a PR

1. Open an issue first for anything beyond a small fix — saves wasted work.
2. Branch from `main`: `feat/<short-name>` or `fix/<short-name>`.
3. Keep the change focused — one feature or one fix per PR.
4. Make sure all of these pass locally:
   ```bash
   npm run typecheck && npm test && npm run check:eval-path && npm run check:open-core
   ```
5. If you added a route, update the IDOR matrix. If you changed the schema, regenerate + commit both engines' artifacts.
6. Write a clear PR description: what changed, why, how to test it, and any trade-offs.

## What we'd love help with

- New **compliance suite manifests** (HIPAA, RBI, EU-AI-Act control mappings)
- **Import adapters** for more eval formats
- **SDKs** in other languages (Python first)
- Better test coverage and the Playwright UI baseline
- Accessibility and i18n in the dashboard

## Licensing

By contributing, you agree your contributions will be licensed under the project's [MIT License](./LICENSE).
