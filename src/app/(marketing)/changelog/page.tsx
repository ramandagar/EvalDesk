export default function ChangelogPage() {
  const versions = [
    {
      version: "v0.3.0",
      date: "May 2, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Multi-model judge consensus for more reliable evaluations",
        },
        {
          type: "feature" as const,
          text: "Safety scoring with toxicity, hallucination, and bias detection",
        },
        {
          type: "feature" as const,
          text: "Citation verification for RAG agent responses",
        },
        {
          type: "improvement" as const,
          text: "Faster test execution with parallel agent calls",
        },
        {
          type: "improvement" as const,
          text: "Redesigned analytics dashboard with trend visualization",
        },
        {
          type: "fix" as const,
          text: "Fixed webhook retry logic for intermittent failures",
        },
      ],
    },
    {
      version: "v0.2.0",
      date: "April 10, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Multi-turn conversation testing support",
        },
        {
          type: "feature" as const,
          text: "Streaming response evaluation with token-level timing",
        },
        {
          type: "feature" as const,
          text: "Tool call validation for agent workflows",
        },
        {
          type: "feature" as const,
          text: "Scheduled runs with cron expressions",
        },
        {
          type: "improvement" as const,
          text: "Expanded judge criteria with domain templates",
        },
        {
          type: "fix" as const,
          text: "Resolved session expiry issues on long-running evaluations",
        },
      ],
    },
    {
      version: "v0.1.0",
      date: "March 15, 2026",
      changes: [
        {
          type: "feature" as const,
          text: "Initial release with core evaluation engine",
        },
        {
          type: "feature" as const,
          text: "LLM-powered judge with customizable criteria",
        },
        {
          type: "feature" as const,
          text: "Test case management with categories and tags",
        },
        {
          type: "feature" as const,
          text: "Run history with pass/fail analytics",
        },
        {
          type: "feature" as const,
          text: "Project-based organization",
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
