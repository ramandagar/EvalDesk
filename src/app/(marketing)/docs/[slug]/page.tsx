import Link from "next/link";
import { notFound } from "next/navigation";

const sidebarCategories = [
  {
    title: "Getting Started",
    items: [
      { slug: "getting-started", label: "Quick Start" },
      { slug: "installation", label: "Installation" },
      { slug: "configuration", label: "Configuration" },
    ],
  },
  {
    title: "Test Cases",
    items: [
      { slug: "creating-test-cases", label: "Creating Test Cases" },
      { slug: "multi-turn", label: "Multi-Turn Testing" },
      { slug: "adversarial", label: "Adversarial Testing" },
    ],
  },
  {
    title: "Runs",
    items: [
      { slug: "running-evals", label: "Running Evaluations" },
      { slug: "scheduling", label: "Scheduled Runs" },
      { slug: "regression", label: "Regression Detection" },
    ],
  },
  {
    title: "LLM Judge",
    items: [
      { slug: "judge-overview", label: "Overview" },
      { slug: "custom-criteria", label: "Custom Criteria" },
      { slug: "multi-judge", label: "Multi-Judge Consensus" },
      { slug: "safety", label: "Safety Scoring" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { slug: "slack", label: "Slack" },
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
    title: "Getting Started",
    content: `<p>Welcome to EvalDesk. This guide will walk you through setting up your first evaluation in under five minutes. EvalDesk lets you systematically test your AI agents with structured test cases, LLM-powered judging, and comprehensive analytics.</p>
<h3>1. Create an account</h3><p>Sign up at evaldesk.dev with your email or GitHub account. No credit card is required for the Free plan.</p>
<h3>2. Create a project</h3><p>A project represents one AI agent you want to evaluate. Give it a name, provide your agent's endpoint URL, and optionally set an API key for authentication.</p>
<h3>3. Write test cases</h3><p>Create test cases that define what you want to test. Each test case has an input and an expected output.</p>
<h3>4. Run your first evaluation</h3><p>Click "Run Evaluation" to execute all your test cases against your agent. EvalDesk sends each input to your agent, collects responses, and uses an LLM Judge to evaluate results.</p>
<h3>5. Review results</h3><p>After a run completes, review the results to see which test cases passed or failed with detailed reasoning and metrics.</p>`,
  },
  installation: {
    title: "Installation",
    content: `<p>EvalDesk is a web-based platform, so there is no installation required. Simply sign up at evaldesk.dev and start using the platform immediately.</p>
<h3>Self-hosting</h3><p>If you prefer to self-host EvalDesk, you can clone our repository and deploy it on your own infrastructure. EvalDesk requires Node.js 18+, a SQLite database, and an OpenAI API key for the LLM Judge.</p>
<h3>Python SDK</h3><p>Install our Python SDK to programmatically create test cases and run evaluations:</p>
<pre><code>pip install evaldesk</code></pre>
<h3>Node.js SDK</h3><p>Install our Node.js SDK for JavaScript/TypeScript projects:</p>
<pre><code>npm install @evaldesk/sdk</code></pre>`,
  },
  configuration: {
    title: "Configuration",
    content: `<p>After creating a project, configure your agent endpoint and evaluation settings.</p>
<h3>Agent Endpoint</h3><p>Set the URL where EvalDesk will send test case inputs. The endpoint must accept POST requests with a JSON body containing a "message" field and return a JSON response with a "response" field.</p>
<h3>Authentication</h3><p>Configure your agent's API key if required. EvalDesk sends it as a Bearer token in the Authorization header.</p>
<h3>Default Model</h3><p>Choose which LLM model the Judge should use by default. Options include GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, and others.</p>
<h3>Custom Headers</h3><p>Add any custom HTTP headers that your agent endpoint requires, such as API keys for specific services or custom identifiers.</p>`,
  },
  "creating-test-cases": {
    title: "Creating Test Cases",
    content: `<p>Test cases are the building blocks of your evaluation suite. Each test case defines one scenario to evaluate.</p>
<h3>Test Case Fields</h3>
<ul><li><strong>Input</strong> — The message or prompt sent to your agent</li><li><strong>Expected Output</strong> — A description of what the ideal response should contain</li><li><strong>Category</strong> — Optional grouping (e.g., "billing", "technical", "safety")</li><li><strong>Tags</strong> — Optional labels for filtering and organization</li></ul>
<h3>Bulk Creation</h3><p>Use the bulk creation feature to import multiple test cases at once from a CSV or JSON file. You can also use AI to generate test cases based on your agent's domain.</p>
<h3>Golden Sets</h3><p>Mark your most important test cases as part of a "golden set" to ensure they are always included in regression testing.</p>`,
  },
  "multi-turn": {
    title: "Multi-Turn Testing",
    content: `<p>Multi-turn testing lets you evaluate agents across full conversations rather than single interactions.</p>
<h3>Creating Conversations</h3><p>Group multiple test cases into a conversation thread. Each test case in the conversation represents one turn, with the agent maintaining context from previous turns.</p>
<h3>Conversation Flows</h3><p>Define complex conversation flows that test how your agent handles context switching, follow-up questions, and clarification requests across multiple turns.</p>`,
  },
  adversarial: {
    title: "Adversarial Testing",
    content: `<p>Adversarial testing helps you find vulnerabilities in your AI agent before users do.</p>
<h3>Adversarial Types</h3>
<ul><li><strong>Jailbreak</strong> — Attempts to bypass safety guardrails</li><li><strong>Prompt Injection</strong> — Tests for injection vulnerability in user inputs</li><li><strong>Data Leak</strong> — Checks if the agent reveals sensitive information</li><li><strong>Bias Probe</strong> — Tests for biased or discriminatory outputs</li></ul>
<h3>AI-Generated Adversarial Cases</h3><p>Use our AI-powered adversarial generator to automatically create test cases designed to probe your agent's weaknesses.</p>`,
  },
  "running-evals": {
    title: "Running Evaluations",
    content: `<p>Evaluations execute all test cases in a project against your agent and collect the results.</p>
<h3>Manual Runs</h3><p>Trigger an evaluation manually from the dashboard. Results appear in real-time as each test case is processed.</p>
<h3>API Runs</h3><p>Trigger evaluations programmatically via the API. Useful for running evaluations as part of your CI/CD pipeline.</p>
<h3>Run Status</h3><p>Each run has a status: running, completed, or failed. View detailed metrics including pass rate, response times, and judge scores.</p>`,
  },
  scheduling: {
    title: "Scheduled Runs",
    content: `<p>Set up automatic evaluations that run on a schedule using cron expressions.</p>
<h3>Creating a Schedule</h3><p>Navigate to your project settings and define a cron expression for how often you want evaluations to run. Common schedules include hourly, daily, and weekly.</p>
<h3>Notifications</h3><p>Configure notifications to alert your team when scheduled runs complete or when regression is detected.</p>`,
  },
  regression: {
    title: "Regression Detection",
    content: `<p>EvalDesk automatically detects when your agent's performance degrades between runs.</p>
<h3>How It Works</h3><p>Each run's pass rate is compared against previous runs. A significant drop triggers a regression alert, highlighting which test cases changed from pass to fail.</p>
<h3>Pass Thresholds</h3><p>Set a minimum pass threshold for your projects. Runs that fall below the threshold are flagged as gated, preventing deployment until issues are resolved.</p>`,
  },
  "judge-overview": {
    title: "LLM Judge Overview",
    content: `<p>The LLM Judge uses a language model to evaluate whether your agent's responses meet expectations.</p>
<h3>How It Works</h3><p>For each test case, the Judge compares the agent's actual response against the expected output. It produces a pass/fail/partial rating, a numerical score (0-100), and detailed reasoning explaining the evaluation.</p>
<h3>Supported Models</h3><p>The Judge can use GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, and other leading models. Choose the model that best fits your accuracy and cost requirements.</p>`,
  },
  "custom-criteria": {
    title: "Custom Judge Criteria",
    content: `<p>Define your own evaluation rubrics for domain-specific scoring.</p>
<h3>Creating Criteria</h3><p>Write custom evaluation prompts that the Judge uses to assess responses. Include specific scoring guidelines, must-include elements, and quality thresholds.</p>
<h3>Domain Templates</h3><p>Use pre-built templates for common domains like healthcare, legal, finance, and customer support. Templates include specialized criteria for each domain's unique requirements.</p>`,
  },
  "multi-judge": {
    title: "Multi-Judge Consensus",
    content: `<p>Use multiple LLM models to evaluate each response and reach a consensus rating.</p>
<h3>How Consensus Works</h3><p>Each model independently evaluates the response. The final rating is determined by majority vote. This approach reduces individual model bias and produces more reliable evaluations.</p>
<h3>Configuring Models</h3><p>Select which models participate in the consensus evaluation. We recommend using at least three different models for robust results.</p>`,
  },
  safety: {
    title: "Safety Scoring",
    content: `<p>Automatically detect safety issues in your agent's responses.</p>
<h3>Scoring Dimensions</h3>
<ul><li><strong>Toxicity</strong> — Detects harmful, offensive, or inappropriate content</li><li><strong>Hallucination</strong> — Identifies factually incorrect or fabricated information</li><li><strong>Bias</strong> — Flags biased or discriminatory language</li></ul>
<h3>Flagged Issues</h3><p>Each safety score comes with a list of flagged issues with specific details about what was detected and why.</p>`,
  },
  slack: {
    title: "Slack Integration",
    content: `<p>Send evaluation results and alerts to your Slack channels.</p>
<h3>Setup</h3><p>Provide your Slack webhook URL and select which channel to post to. Configure which events trigger notifications (run completed, regression detected, etc.).</p>
<h3>Notification Events</h3><p>Choose from events like run.completed, regression.detected, and schedule.triggered to control what gets posted to Slack.</p>`,
  },
  webhooks: {
    title: "Webhooks",
    content: `<p>Send real-time HTTP notifications to any endpoint when events occur in EvalDesk.</p>
<h3>Configuring Webhooks</h3><p>Add a webhook URL, select which events to subscribe to, and optionally provide a secret for payload verification. EvalDesk sends signed POST requests with event details.</p>
<h3>Delivery Logs</h3><p>View a log of all webhook deliveries including status codes, response bodies, and retry attempts for failed deliveries.</p>`,
  },
  "ci-cd": {
    title: "CI/CD Integration",
    content: `<p>Integrate EvalDesk into your continuous integration and deployment pipelines.</p>
<h3>API Trigger</h3><p>Use the /api/run endpoint to trigger evaluations from your CI pipeline. Pass your API key in the Authorization header and provide the project ID.</p>
<h3>Regression Gating</h3><p>Configure your pipeline to block deployments when evaluations fall below the pass threshold. Use the regression detection API to check run status programmatically.</p>`,
  },
  "api-overview": {
    title: "API Overview",
    content: `<p>The EvalDesk API allows you to programmatically manage projects, test cases, runs, and results.</p>
<h3>Base URL</h3><pre><code>https://evaldesk.dev/api</code></pre>
<h3>Rate Limits</h3><p>API requests are rate limited based on your plan. Free accounts get 100 requests per hour, Pro gets 1,000, and Enterprise gets unlimited access.</p>
<h3>Response Format</h3><p>All API responses are returned as JSON. Standard HTTP status codes are used to indicate success or failure.</p>`,
  },
  "api-authentication": {
    title: "API Authentication",
    content: `<p>Authenticate API requests using your API key.</p>
<h3>Creating an API Key</h3><p>Navigate to Settings &gt; API Keys and create a new key. Give it a name and select the permissions (read, write, or admin).</p>
<h3>Using Your Key</h3><p>Include your API key in the Authorization header of every request:</p>
<pre><code>Authorization: Bearer evd_your_api_key_here</code></pre>
<h3>Key Security</h3><p>Never expose your API key in client-side code. Store it in environment variables and restrict permissions to the minimum needed.</p>`,
  },
  "api-endpoints": {
    title: "API Endpoints",
    content: `<p>Reference for all available API endpoints.</p>
<h3>Projects</h3>
<ul><li><strong>GET /api/projects</strong> — List all projects</li><li><strong>POST /api/projects</strong> — Create a project</li><li><strong>GET /api/projects/:id</strong> — Get a project</li><li><strong>PATCH /api/projects/:id</strong> — Update a project</li></ul>
<h3>Test Cases</h3>
<ul><li><strong>GET /api/test-cases</strong> — List test cases</li><li><strong>POST /api/test-cases</strong> — Create a test case</li><li><strong>GET /api/test-cases/:id</strong> — Get a test case</li><li><strong>PATCH /api/test-cases/:id</strong> — Update a test case</li></ul>
<h3>Runs</h3>
<ul><li><strong>GET /api/runs</strong> — List runs</li><li><strong>POST /api/run</strong> — Trigger a new run</li><li><strong>GET /api/runs/:id</strong> — Get run details</li></ul>`,
  },
};

export default function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // We need to use the slug synchronously for static generation
  // In Next.js 15, params is a Promise on dynamic pages
  void params;

  // We use a client-side approach via a wrapper component
  return <DocContent params={params} />;
}

async function DocContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docsContent[slug];

  if (!doc) {
    notFound();
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-5 flex">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-black/[0.06] pt-24 pb-20 pr-6 hidden md:block">
          <nav className="sticky top-24 space-y-6">
            {sidebarCategories.map((category) => (
              <div key={category.title}>
                <h4 className="text-[12px] font-semibold text-[#8a8f98] uppercase tracking-wider mb-2">
                  {category.title}
                </h4>
                <ul className="space-y-1">
                  {category.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/docs/${item.slug}`}
                        className={`block text-[14px] py-1 transition-colors ${
                          item.slug === slug
                            ? "text-[#ABC83A] font-medium"
                            : "text-[#8a8f98] hover:text-[#0a0a0a]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 pt-24 pb-20 pl-0 md:pl-10 min-w-0">
          <h1
            className="text-[32px] font-semibold text-[#0a0a0a]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {doc.title}
          </h1>
          <p className="text-[13px] text-[#8a8f98] mt-1">
            Last updated: May 1, 2026
          </p>
          <div
            className="mt-8 space-y-4
              [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:text-[#0a0a0a] [&_h2]:mt-8 [&_h2]:mb-3
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
    </div>
  );
}
