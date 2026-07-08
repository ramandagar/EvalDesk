# SPEC: Docs rewrite + Benchmark pack (agent builds both)

## Part 1 — Fix the in-app /docs page

**File:** `src/app/(marketing)/docs/[slug]/page.tsx`

### Sidebar — REMOVE these fictional pages:
- Entire "Advanced Testing" section: `multi-turn`, `adversarial` (we have safety probes now, different name)
- Entire "Automation" section: `scheduling` (doesn't exist)
- From "Integrations": remove `slack` (doesn't exist). Keep `webhooks`, `ci-cd`.

### Sidebar — ADD these real pages:
- Under "Getting Started": `judge-config` (per-project AI judge setup)
- Under "Evaluation": `compliance` (HIPAA + EU-AI-Act packs), `rag-eval` (faithfulness with context), `safety-probes` (adversarial generation)

### Content fixes (the `docsContent` record):

**`getting-started`:**
- Step 1: "Sign up with your email" (NOT GitHub)
- Step 2: "Create a project — give it a name and your agent's HTTP endpoint URL"
- Step 3: "Add test cases — input + expected output. Optionally add `context` for RAG faithfulness, or `category` for compliance coverage."
- Step 4: "Click Run Eval. The AI judge scores every answer. Uncertain cases route to human review."
- Step 5: "Review flagged cases, sign off, get a signed certificate."

**`installation`:**
- REMOVE: "pip install evaldesk", "SQLite database", "OpenAI API key"
- REPLACE with: "Self-host with Docker + Postgres. Clone the repo, copy `.env.example` to `.env`, set your encryption keys + DeepSeek/OpenAI key, run `docker compose up`."
- Keep the Node.js SDK mention but use REAL install: `npm install @evaldesk/sdk`
- Python SDK: `pip install evaldesk` (now real — it exists in sdk/python/)

**`configuration`:**
- REMOVE: "Slack", "GitHub auth", "agentHeaders"
- Agent endpoint: "Any HTTP URL that accepts POST and returns a response. Works with custom agents, OpenAI-compatible APIs, LangChain (via wrapper), etc."
- Judge config: "Set a per-project judge endpoint (any OpenAI-compatible URL) + model + API key in the project's Judge tab."
- Categories: "Tag test cases with categories like `access_control`, `audit_logging` to map to HIPAA controls."

**`api-endpoints`:**
- ALL paths must be `/api/v1/*` (NOT `/api/projects`)
- List the REAL endpoints:
  - `POST /api/v1/projects` — create project
  - `GET /api/v1/projects/:id` — get project
  - `POST /api/v1/test-cases` — create test case (supports `context` + `category`)
  - `POST /api/v1/runs` — create run (async, returns 202)
  - `GET /api/v1/runs/:id` — poll status
  - `GET /api/v1/runs/:id/results` — full report
  - `GET /api/v1/runs/:id/coverage?suite=hipaa` — compliance coverage
  - `POST /api/v1/results/:id/verdicts` — submit human verdict
  - `POST /api/v1/runs/:id/signoff` — approve/reject
  - `GET /api/v1/runs/:id/certificate` — signed certificate
  - `POST /api/v1/projects/:id/probes` — generate safety probes
  - `POST /api/v1/imports` — import DeepEval/Langfuse/OpenAI-Evals datasets
  - `GET /api/v1/api-keys` — list/create API keys
  - `POST /api/v1/webhooks` — register webhook
  - `GET /api/v1/members` — team management

**`api-authentication`:**
- Session: `evaldesk_session` cookie (set on login/signup)
- API key: `Authorization: Bearer evaldesk_live_...` (create in the API Keys page)
- Org header: `x-org-id` required on all `/api/v1/*` calls (get from `/api/v1/me`)

### New page content to ADD:

**`judge-config`** (new):
"Configure your AI judge per-project. Set a base URL (any OpenAI-compatible endpoint — DeepSeek, OpenAI, OpenRouter, Ollama, local vLLM), a model name, and an API key. The key is encrypted at rest. Leave blank to use the server default judge."

**`compliance`** (new):
"EvalDesk ships with HIPAA (10 controls, §164.312/§164.308) and EU AI Act (5 articles, Art. 9-15) compliance packs. Tag your test cases with categories like `access_control`, `human_oversight`. When a run finalizes, the control-coverage matrix is embedded in the signed certificate."

**`rag-eval`** (new):
"Add a `context` field to your test case (the retrieved source documents). The judge runs an additional faithfulness check — is every claim in the agent's answer grounded in the context? Detects hallucinations. Stored as a separate AI score with a `rag:` prefix."

**`safety-probes`** (new):
"POST /api/v1/projects/:id/probes generates adversarial test cases automatically. Three types: jailbreak, prompt_injection, pii_leak. Each becomes a test case with the attack input + the expected safe response. The judge scores whether your agent resisted the attack."

## Part 2 — Benchmark pack (the viral hook)

**File:** `src/lib/suites/packs/medical-triage-benchmark.ts` (new)

A prebuilt set of ~15 medical triage test cases, each with:
- Realistic patient complaint (input)
- The correct medical advice (expectedOutput)
- A HIPAA category tag
- Some with `context` (source medical guidelines for RAG faithfulness)

Format — export as a typed constant:
```ts
export interface BenchmarkCase {
  title: string;
  input: string;
  expectedOutput: string;
  category: string; // HIPAA category
  context?: string; // optional source docs for RAG
}

export const MEDICAL_TRIAGE_BENCHMARK: { id: string; name: string; version: string; cases: BenchmarkCase[] } = {
  id: "medical-triage-v1",
  name: "Medical Triage Benchmark v1.0",
  version: "1.0.0",
  cases: [
    // 15 cases covering: chest pain, overdose, pediatric fever, stroke symptoms,
    // allergic reaction, mental health crisis, medication interaction, pregnancy,
    // head injury, breathing difficulty, seizure, diabetic emergency, burn, 
    // substance abuse, suicidal ideation
    // Each with the CORRECT triage response + HIPAA category
  ],
};
```

**File:** `src/lib/http/benchmark-handler.ts` (new)
- `POST /api/v1/projects/:id/benchmarks/:packId` — imports the benchmark cases into the project.
- `GET /api/v1/benchmarks` — lists available benchmark packs (public, no auth).

**File:** `src/app/api/v1/benchmarks/route.ts` + `src/app/api/v1/projects/[id]/benchmarks/[packId]/route.ts`

The benchmark cases must be medically plausible. Research real triage protocols if needed. The expectedOutput should match standard medical advice (call 911, go to ER, etc.).

## Verify
```bash
npx tsc --noEmit
npx next build
```

## Priority
Do Part 1 (docs) FIRST — it's the credibility fix. Part 2 (benchmark) is the viral hook.
