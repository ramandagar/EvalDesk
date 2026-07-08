import Link from "next/link";
import { notFound } from "next/navigation";

const sidebarCategories = [
  {
    title: "Getting Started",
    items: [
      { slug: "getting-started", label: "Quick Start" },
      { slug: "installation", label: "Self-Hosting" },
      { slug: "configuration", label: "Configuration" },
    ],
  },
  {
    title: "Evaluation",
    items: [
      { slug: "test-cases", label: "Test Cases" },
      { slug: "judge-config", label: "AI Judge" },
      { slug: "compliance", label: "Compliance Packs" },
      { slug: "rag-eval", label: "RAG Faithfulness" },
      { slug: "safety-probes", label: "Safety Probes" },
      { slug: "running-evals", label: "Running Evals" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { slug: "webhooks", label: "Webhooks" },
      { slug: "ci-cd", label: "CI/CD" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { slug: "api-overview", label: "Overview" },
      { slug: "api-authentication", label: "Authentication" },
      { slug: "api-endpoints", label: "Endpoints" },
    ],
  },
];

const docsContent: Record<string, { title: string; content: string }> = {
  "getting-started": {
    title: "Quick Start",
    content: `<p>EvalDesk is an AI-native, expert-verified evaluation platform. An AI judge scores every agent answer; a credentialed expert verifies the uncertain ones; you get a cryptographically signed certificate an auditor accepts.</p>
<h3>1. Sign up</h3><p>Create an account with your email. No credit card required.</p>
<h3>2. Create a project</h3><p>A project represents one AI agent. Give it a name and your agent's HTTP endpoint URL.</p>
<h3>3. Add test cases</h3><p>Each test case has an input and an expected output. Optionally add a <code>category</code> (for compliance) or <code>context</code> (for RAG faithfulness).</p>
<h3>4. Run eval</h3><p>The AI judge scores every answer. Uncertain or disputed cases route to human review.</p>
<h3>5. Review + sign off</h3><p>A domain expert reviews flagged cases (blind, keyboard-first). On sign-off, EvalDesk issues an Ed25519-signed certificate with the compliance coverage matrix.</p>`,
  },
  installation: {
    title: "Self-Hosting",
    content: `<p>EvalDesk is open-source (MIT). Self-host with Docker + Postgres.</p>
<h3>Docker (recommended)</h3>
<pre><code>git clone https://github.com/ramandagar/EvalDesk.git
cd EvalDesk
cp .env.example .env   # fill in encryption keys + LLM key
docker compose up -d</code></pre>
<p>The app starts on port 3000. Migrations run automatically on first boot. The in-process worker starts on the first request.</p>
<h3>Requirements</h3>
<ul><li>Docker + Docker Compose</li><li>An LLM API key (DeepSeek, OpenAI, OpenRouter, or Ollama for local)</li><li>Encryption key: <code>openssl rand -base64 32</code></li></ul>
<h3>SDKs</h3>
<pre><code>pip install evaldesk     # Python
npm install @evaldesk/sdk # TypeScript</code></pre>`,
  },
  configuration: {
    title: "Configuration",
    content: `<h3>Agent endpoint</h3><p>Any HTTP URL that accepts POST and returns a response. Works with custom agents, OpenAI-compatible APIs, and any framework behind an HTTP wrapper.</p>
<h3>AI Judge (per-project)</h3><p>Set a judge endpoint in the project's Judge tab — any OpenAI-compatible URL + model name + API key. The key is encrypted at rest (AES-256-GCM). Leave blank to use the server default.</p>
<h3>Categories</h3><p>Tag test cases with categories like <code>access_control</code>, <code>audit_logging</code>, <code>human_oversight</code> to map them to compliance controls (HIPAA, EU AI Act).</p>
<h3>Context (RAG)</h3><p>Add a <code>context</code> field with source documents. The judge runs an additional faithfulness check — is every claim grounded in the context?</p>`,
  },
  "test-cases": {
    title: "Test Cases",
    content: `<p>Test cases are the building blocks of your evaluation. Each defines one scenario.</p>
<h3>Fields</h3>
<ul><li><strong>Input</strong> — the message sent to your agent</li><li><strong>Expected output</strong> — what a correct answer looks like</li><li><strong>Category</strong> — maps to compliance controls (e.g. <code>access_control</code>)</li><li><strong>Context</strong> — source docs for RAG faithfulness checking</li></ul>
<h3>Import</h3><p>Import from DeepEval, Langfuse, or OpenAI Evals formats via the API or the UI. Format is auto-detected.</p>
<h3>Safety probes</h3><p><code>POST /api/v1/projects/:id/probes</code> generates adversarial test cases (jailbreak, prompt injection, PII leak) automatically.</p>`,
  },
  "judge-config": {
    title: "AI Judge",
    content: `<p>The AI judge scores every agent answer on a pass/fail/partial scale. Configure it per-project with any OpenAI-compatible endpoint.</p>
<h3>Supported providers</h3>
<ul><li>DeepSeek (<code>https://api.deepseek.com/v1</code>)</li><li>OpenAI (<code>https://api.openai.com/v1</code>)</li><li>OpenRouter (<code>https://openrouter.ai/api/v1</code>)</li><li>Ollama / local vLLM (any local URL)</li></ul>
<h3>Honest confidence</h3><p>Confidence is computed from self-consistency sampling and cross-judge agreement — never the model's self-reported number.</p>
<h3>Routing</h3><p>Low-confidence, disagreeing, audit-sampled, or adversarial items automatically route to human review.</p>`,
  },
  compliance: {
    title: "Compliance Packs",
    content: `<p>EvalDesk ships with HIPAA and EU AI Act compliance packs. Each maps regulatory controls to test-case categories.</p>
<h3>HIPAA Security Rule</h3><p>10 controls from 45 CFR §164.312 / §164.308 (access control, audit, integrity, authentication, transmission security, encryption, workforce security, contingency, minimum necessary, de-identification).</p>
<h3>EU AI Act</h3><p>5 high-risk articles: Art. 9 (risk management), Art. 10 (data governance), Art. 13 (transparency), Art. 14 (human oversight), Art. 15 (accuracy/robustness).</p>
<h3>How it works</h3>
<ul><li>Tag test cases with the control's category (e.g. <code>access_control</code>)</li><li>Run the eval + review</li><li>The control-coverage matrix is embedded in the signed certificate</li></ul>
<p>Check coverage: <code>GET /api/v1/runs/:id/coverage?suite=hipaa</code></p>`,
  },
  "rag-eval": {
    title: "RAG Faithfulness",
    content: `<p>Detect hallucinations in retrieval-augmented generation. When a test case has a <code>context</code> field (the retrieved source documents), the judge runs an additional faithfulness check.</p>
<h3>What it checks</h3><p>Is every factual claim in the agent's response directly supported by the source context? No fabrication, no hallucination.</p>
<ul><li><strong>faithful</strong> — all claims grounded in context</li><li><strong>unfaithful</strong> — contains unsupported claims (hallucination)</li><li><strong>partial</strong> — mostly grounded with minor additions</li></ul>
<p>Stored as a separate AI score with a <code>rag:</code> prefix. Optional — only runs when context is present.</p>`,
  },
  "safety-probes": {
    title: "Safety Probes",
    content: `<p>Automatically generate adversarial test cases to probe your agent for vulnerabilities.</p>
<h3>Probe types</h3>
<ul><li><strong>jailbreak</strong> — attempts to bypass safety guardrails</li><li><strong>prompt_injection</strong> — injects hidden instructions</li><li><strong>pii_leak</strong> — attempts to extract sensitive information</li></ul>
<h3>Usage</h3>
<pre><code>POST /api/v1/projects/:id/probes
{ "type": "jailbreak", "count": 5 }</code></pre>
<p>Each probe becomes a test case with the attack input + the expected safe response. The judge scores whether your agent resisted the attack.</p>`,
  },
  "running-evals": {
    title: "Running Evaluations",
    content: `<p>Evaluations run asynchronously via a job queue. No LLM I/O on the request thread.</p>
<h3>Create a run</h3>
<pre><code>POST /api/v1/runs
{ "projectId": "..." }
→ 202 Accepted (returns run ID)</code></pre>
<h3>Poll status</h3>
<pre><code>GET /api/v1/runs/:id
→ { "run": { "status": "completed", "passCount": 8, ... } }</code></pre>
<h3>Full report</h3>
<pre><code>GET /api/v1/runs/:id/results</code></pre>
<p>Returns per-case: input, agent response, AI scores, human verdicts, final label, token usage, cost.</p>`,
  },
  webhooks: {
    title: "Webhooks",
    content: `<p>HMAC-signed event delivery. Subscribe to events and receive signed POST requests.</p>
<h3>Events</h3>
<ul><li><code>run.completed</code></li><li><code>run.failed</code></li><li><code>certificate.signed</code></li><li><code>verdict.submitted</code></li></ul>
<h3>Setup</h3>
<pre><code>POST /api/v1/webhooks
{ "url": "https://your-app.com/hook", "events": ["certificate.signed"] }</code></pre>
<p>Signature: <code>EvalDesk-Signature: t=&lt;ts&gt;,v1=&lt;hmac&gt;</code>. Verify with the signing secret (returned once at creation).</p>`,
  },
  "ci-cd": {
    title: "CI/CD",
    content: `<p>Gate your pipeline on eval results using the GitHub Action or SDKs.</p>
<h3>GitHub Action</h3>
<pre><code>- uses: ramandagar/EvalDesk@v1
  with:
    base_url: https://your-instance.com
    token: $&#123; secrets.EVALDESK_TOKEN &#125;
    org: $&#123; secrets.EVALDESK_ORG &#125;
    project_id: proj_abc
    min_pass_rate: 0.9</code></pre>
<h3>Python SDK</h3>
<pre><code>from evaldesk import EvalDesk, assert_run_passes
client = EvalDesk("https://your-instance.com", token, org)
run = client.runs.create(project_id="proj_abc")
run = client.runs.wait(run["id"])
assert_run_passes(run, min_pass_rate=0.9)</code></pre>`,
  },
  "api-overview": {
    title: "API Overview",
    content: `<p>The EvalDesk REST API is versioned at <code>/api/v1</code>. All endpoints are org-scoped and require authentication.</p>
<h3>Base URL</h3><p><code>https://your-instance.com/api/v1</code></p>
<h3>Org scoping</h3><p>Every request requires an <code>x-org-id</code> header. Get your org ID from <code>GET /api/v1/me</code>.</p>`,
  },
  "api-authentication": {
    title: "Authentication",
    content: `<h3>Session (browser)</h3><p>The <code>evaldesk_session</code> cookie is set on login/signup. Sent automatically by browsers.</p>
<h3>API key (programmatic)</h3>
<pre><code>Authorization: Bearer evaldesk_live_...</code></pre>
<p>Create keys in the API Keys page. Only the SHA-256 hash is stored. Keys support scoped capabilities.</p>
<h3>Org header</h3>
<pre><code>x-org-id: org_abc123</code></pre>
<p>Required on all <code>/api/v1/*</code> calls. Get from <code>GET /api/v1/me</code>.</p>`,
  },
  "api-endpoints": {
    title: "Endpoints",
    content: `<h3>Projects</h3>
<ul><li><code>GET /api/v1/projects</code> — list</li><li><code>POST /api/v1/projects</code> — create</li><li><code>GET /api/v1/projects/:id</code> — get</li><li><code>PUT /api/v1/projects/:id</code> — update</li></ul>
<h3>Test cases</h3>
<ul><li><code>POST /api/v1/test-cases</code> — create (supports context, category)</li><li><code>POST /api/v1/imports</code> — bulk import (DeepEval/Langfuse/OpenAI-Evals)</li><li><code>POST /api/v1/projects/:id/probes</code> — generate safety probes</li></ul>
<h3>Runs</h3>
<ul><li><code>POST /api/v1/runs</code> — create (async, 202)</li><li><code>GET /api/v1/runs/:id</code> — poll status</li><li><code>GET /api/v1/runs/:id/results</code> — full report</li><li><code>GET /api/v1/runs/:id/coverage?suite=hipaa</code> — compliance matrix</li><li><code>GET /api/v1/runs/:id/report?format=html</code> — downloadable report</li></ul>
<h3>Review</h3>
<ul><li><code>GET /api/v1/runs/:id/queue</code> — review queue (blind-aware)</li><li><code>POST /api/v1/results/:id/verdicts</code> — submit verdict</li><li><code>POST /api/v1/runs/:id/signoff</code> — approve/reject</li></ul>
<h3>Certificate</h3>
<ul><li><code>GET /api/v1/runs/:id/certificate</code> — signed certificate bundle</li></ul>
<h3>Other</h3>
<ul><li><code>GET /api/v1/api-keys</code> / <code>POST</code> / <code>DELETE</code></li><li><code>GET /api/v1/webhooks</code> / <code>POST</code></li><li><code>GET /api/v1/members</code> / <code>POST</code> / <code>PATCH</code></li><li><code>GET /api/v1/analytics</code></li></ul>`,
  },
};

export function generateStaticParams() {
  return Object.keys(docsContent).map((slug) => ({ slug }));
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docsContent[slug];
  if (!doc) notFound();

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 flex gap-12">
      <aside className="w-56 shrink-0 hidden md:block">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ABC83A]">
            <span className="text-[12px] font-bold text-[#09090b]">E</span>
          </div>
          <span className="text-[15px] font-semibold">EvalDesk</span>
        </Link>
        {sidebarCategories.map((cat) => (
          <div key={cat.title} className="mb-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8f98] mb-2">{cat.title}</h3>
            <ul className="space-y-1">
              {cat.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${item.slug}`}
                    className={`text-[13px] block py-1 ${item.slug === slug ? "text-[#ABC83A] font-medium" : "text-[#8a8f98] hover:text-[#0a0a0a]"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>
      <main className="flex-1 min-w-0">
        <h1 className="text-[28px] font-semibold tracking-tight mb-6">{doc.title}</h1>
        <div
          className="prose prose-sm dark:prose-invert max-w-none
              [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:text-[#0a0a0a] [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:text-[15px] [&_p]:text-[#8a8f98] [&_p]:leading-relaxed [&_p]:mb-4
              [&_ul]:text-[#8a8f98] [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1
              [&_li]:text-[15px] [&_li]:leading-relaxed
              [&_a]:text-[#ABC83A] [&_a]:underline
              [&_code]:bg-[#f5f5f5] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]
              [&_pre]:bg-[#f5f5f5] [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre]:text-[13px]
              [&_strong]:text-[#0a0a0a] [&_strong]:font-medium"
          dangerouslySetInnerHTML={{ __html: doc.content }}
        />
      </main>
    </div>
  );
}
