import Link from "next/link";

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

export default function DocsPage() {
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
                        className="block text-[14px] text-[#8a8f98] hover:text-[#0a0a0a] transition-colors py-1"
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
            Getting Started
          </h1>
          <p className="text-[13px] text-[#8a8f98] mt-1">
            Last updated: May 1, 2026
          </p>

          <div className="mt-8 space-y-6">
            <section>
              <h2 className="text-[20px] font-semibold text-[#0a0a0a] mb-3">
                Quick Start Guide
              </h2>
              <p className="text-[15px] text-[#8a8f98] leading-relaxed">
                Welcome to EvalDesk. This guide will walk you through setting up
                your first evaluation in under five minutes. EvalDesk lets you
                systematically test your AI agents with structured test cases,
                LLM-powered judging, and comprehensive analytics.
              </p>
            </section>

            <section>
              <h3 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
                1. Create an account
              </h3>
              <p className="text-[15px] text-[#8a8f98] leading-relaxed">
                Sign up at evaldesk.dev with your email or GitHub account. No
                credit card is required for the Free plan. Once signed in, you
                will land on the dashboard where you can create your first
                project.
              </p>
            </section>

            <section>
              <h3 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
                2. Create a project
              </h3>
              <p className="text-[15px] text-[#8a8f98] leading-relaxed">
                A project represents one AI agent you want to evaluate. Give it
                a name, provide your agent&apos;s endpoint URL, and optionally set
                an API key for authentication. EvalDesk supports any HTTP-based
                agent endpoint that accepts JSON input and returns JSON output.
              </p>
              <div className="mt-4 rounded-lg bg-[#fafafa] border border-black/[0.06] p-4">
                <code className="text-[13px] text-[#0a0a0a]">
                  POST https://your-agent.example.com/chat
                  <br />
                  Content-Type: application/json
                  <br />
                  Authorization: Bearer YOUR_API_KEY
                </code>
              </div>
            </section>

            <section>
              <h3 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
                3. Write test cases
              </h3>
              <p className="text-[15px] text-[#8a8f98] leading-relaxed">
                Create test cases that define what you want to test. Each test
                case has an input (what you send to your agent) and an expected
                output (what the agent should return). You can also add tags and
                categories to organize your test suite.
              </p>
              <div className="mt-4 rounded-lg bg-[#fafafa] border border-black/[0.06] p-4 space-y-2">
                <p className="text-[13px] font-medium text-[#0a0a0a]">
                  Example Test Case
                </p>
                <p className="text-[13px] text-[#8a8f98]">
                  <strong className="text-[#0a0a0a]">Input:</strong> &quot;What is
                  the return policy for electronics?&quot;
                </p>
                <p className="text-[13px] text-[#8a8f98]">
                  <strong className="text-[#0a0a0a]">Expected:</strong> &quot;A
                  clear explanation of the 30-day return policy for electronics,
                  including any restocking fees.&quot;
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
                4. Run your first evaluation
              </h3>
              <p className="text-[15px] text-[#8a8f98] leading-relaxed">
                Click &quot;Run Evaluation&quot; to execute all your test cases against
                your agent. EvalDesk sends each input to your agent, collects
                the responses, and uses an LLM Judge to evaluate whether each
                response meets the expected output. Results appear in real-time
                on the dashboard with pass/fail ratings and detailed reasoning.
              </p>
            </section>

            <section>
              <h3 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
                5. Review results
              </h3>
              <p className="text-[15px] text-[#8a8f98] leading-relaxed">
                After a run completes, review the results to see which test
                cases passed or failed. For each result, you can view the
                agent&apos;s actual response, the judge&apos;s score and reasoning, and
                response time metrics. Use the analytics dashboard to track
                trends over time and catch regressions early.
              </p>
            </section>

            <section className="mt-8 p-5 rounded-xl border border-[#ABC83A]/20 bg-[#ABC83A]/5">
              <h3 className="text-[15px] font-semibold text-[#0a0a0a]">
                Need help?
              </h3>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed mt-1">
                Check out the rest of the documentation or reach out to us at{" "}
                <a
                  href="mailto:hello@evaldesk.dev"
                  className="text-[#ABC83A] hover:underline"
                >
                  hello@evaldesk.dev
                </a>{" "}
                if you have questions.
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
