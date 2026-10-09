export default function ChangelogPage() {
  const versions = [
    {
      version: "v0.8.0",
      date: "October 8, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Anthropic Claude Sonnet 5.5 & Claude Opus 5 judge integrations with fine-grained rubric evaluation and reasoning token telemetry",
        },
        {
          type: "feature" as const,
          text: "Ed25519 cryptographically signed compliance certificates with offline verification CLI (evaldesk-verify)",
        },
        {
          type: "feature" as const,
          text: "Official Python SDK (evaldesk) with Pytest assertion gates (assert_run_passes)",
        },
        {
          type: "improvement" as const,
          text: "Automated schema codegen and dual PostgreSQL / SQLite database driver parity",
        },
        {
          type: "fix" as const,
          text: "Resolved session token validation edge cases and sticky layout navigation",
        },
      ],
    },
    {
      version: "v0.7.0",
      date: "September 18, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Automated HIPAA Security Rule (45 CFR § 164.312) & EU AI Act compliance packs",
        },
        {
          type: "feature" as const,
          text: "RAG Faithfulness scoring with context-grounding hallucination detection",
        },
        {
          type: "feature" as const,
          text: "Adversarial red-team safety probes (jailbreaks, prompt injection, PII/PHI leak detection)",
        },
        {
          type: "improvement" as const,
          text: "Multi-model judge ensemble with Cohen's & Fleiss' Kappa agreement metrics",
        },
        {
          type: "fix" as const,
          text: "Optimized database query indexing on run results for sub-second report generation",
        },
      ],
    },
    {
      version: "v0.6.0",
      date: "August 21, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Claude 4.5 Sonnet judge integration with chain-of-thought verification",
        },
        {
          type: "feature" as const,
          text: "Human-in-the-loop expert review workflow with blind dual-annotation",
        },
        {
          type: "feature" as const,
          text: "Streaming response evaluation with token-level timing and TTFT tracking",
        },
        {
          type: "improvement" as const,
          text: "Reduced memory overhead for high-concurrency 10,000+ test case batches",
        },
        {
          type: "fix" as const,
          text: "Fixed SSE connection dropouts during long-running batch evaluation runs",
        },
      ],
    },
    {
      version: "v0.5.0",
      date: "July 24, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Prebuilt Medical Triage & Clinical Decision benchmark packs",
        },
        {
          type: "feature" as const,
          text: "Custom evaluation rubrics with weighted scoring criteria and markdown guidelines",
        },
        {
          type: "feature" as const,
          text: "Webhook trigger system for automated CI/CD pipeline blocking",
        },
        {
          type: "improvement" as const,
          text: "Enhanced audit log trail with immutable SHA-256 event hashing",
        },
        {
          type: "fix" as const,
          text: "Resolved pagination state loss when filtering benchmark results",
        },
      ],
    },
    {
      version: "v0.4.0",
      date: "June 19, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Agent tool call and function invocation validation against JSON Schema definitions",
        },
        {
          type: "feature" as const,
          text: "Semantic similarity judge using calibrated cross-encoder embeddings",
        },
        {
          type: "feature" as const,
          text: "Role-based access control (RBAC) with Owner, Admin, and Reviewer permissions",
        },
        {
          type: "improvement" as const,
          text: "Dark / light theme system with adaptive UI components",
        },
        {
          type: "fix" as const,
          text: "Resolved webhook retry logic for intermittent HTTP 5xx responses",
        },
      ],
    },
    {
      version: "v0.3.0",
      date: "May 15, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Multi-model judge consensus for high-confidence evaluation decisions",
        },
        {
          type: "feature" as const,
          text: "Safety scoring with toxicity, hate speech, and PII leakage detection",
        },
        {
          type: "feature" as const,
          text: "Citation and source-grounding verification for RAG agent responses",
        },
        {
          type: "improvement" as const,
          text: "Faster test execution with parallel agent calls and connection pooling",
        },
        {
          type: "fix" as const,
          text: "Fixed edge-case race condition in concurrent run dispatching",
        },
      ],
    },
    {
      version: "v0.2.0",
      date: "April 18, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Multi-turn conversation testing support with dynamic scenario branching",
        },
        {
          type: "feature" as const,
          text: "Streaming response evaluation with token-level timing metrics",
        },
        {
          type: "feature" as const,
          text: "Scheduled recurring evaluation runs with cron expressions",
        },
        {
          type: "improvement" as const,
          text: "Expanded judge criteria library with domain-specific clinical and financial templates",
        },
        {
          type: "fix" as const,
          text: "Resolved session expiry and token refresh issues on long-running evaluations",
        },
      ],
    },
    {
      version: "v0.1.0",
      date: "March 15, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Initial release with core agent evaluation engine",
        },
        {
          type: "feature" as const,
          text: "LLM-powered judge with customizable criteria and scoring rubrics",
        },
        {
          type: "feature" as const,
          text: "Test case management with categories, tags, and bulk CSV/JSON import",
        },
        {
          type: "feature" as const,
          text: "Run history with pass/fail analytics and latency breakdowns",
        },
        {
          type: "improvement" as const,
          text: "Project-based organization and scoped API key authentication",
        },
      ],
    },
  ];

  const badgeStyles = {
    feature:
      "bg-green-50 text-green-700 border border-green-200",
    improvement:
      "bg-blue-50 text-blue-700 border border-blue-200",
    fix: "bg-amber-50 text-amber-700 border border-amber-200",
  };

  const badgeLabels = {
    feature: "Feature",
    improvement: "Improvement",
    fix: "Fix",
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <section className="pt-24 pb-12 text-center max-w-6xl mx-auto px-5">
        <span className="section-label">Changelog</span>
        <h1
          className="text-[32px] font-semibold text-[#0a0a0a] mt-5"
          style={{ letterSpacing: "-0.03em" }}
        >
          What&apos;s new in EvalDesk
        </h1>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 max-w-xl mx-auto">
          Every improvement, new feature, and bug fix — documented.
        </p>
      </section>

      {/* Timeline */}
      <section className="pb-20 max-w-3xl mx-auto px-5">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-black/[0.06]" />

          <div className="space-y-10">
            {versions.map((version, i) => (
              <div key={version.version} className="relative pl-10">
                {/* Timeline dot */}
                <div
                  className={`absolute left-0 top-1.5 w-[31px] h-[31px] rounded-full border-2 flex items-center justify-center ${
                    i === 0
                      ? "border-[#ABC83A] bg-[#ABC83A]/10"
                      : "border-black/10 bg-white"
                  }`}
                >
                  {i === 0 && (
                    <div className="w-2 h-2 rounded-full bg-[#ABC83A]" />
                  )}
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <h3
                      className="text-[16px] font-semibold text-[#0a0a0a]"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {version.version}
                    </h3>
                    <span className="text-[13px] text-[#8a8f98]">
                      {version.date}
                    </span>
                    {i === 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#ABC83A]/10 text-[#ABC83A]">
                        Latest
                      </span>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {version.changes.map((change, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 ${
                            badgeStyles[change.type]
                          }`}
                        >
                          {badgeLabels[change.type]}
                        </span>
                        <span className="text-[14px] text-[#0a0a0a] leading-relaxed">
                          {change.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
