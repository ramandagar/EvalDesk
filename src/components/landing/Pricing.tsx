import Link from "next/link";

export function Pricing() {
  const plans = [
    {
      name: "Open Source",
      price: "Free",
      description: "MIT Licensed. Self-host on your own infrastructure.",
      features: [
        "Multi-model LLM judges (Claude, GPT-4o, DeepSeek)",
        "Credentialed domain expert review interface",
        "Ed25519 cryptographically signed audit certificates",
        "Python & TypeScript SDKs with CI/CD assertions",
        "Unlimited local runs and custom rubrics",
        "Single-command deployment (docker compose up)",
      ],
      cta: "View on GitHub",
      ctaLink: "https://github.com/ramandagar/EvalDesk",
      highlight: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For teams running automated CI/CD agent pipelines",
      features: [
        "Everything in Open Source",
        "Managed multi-model judge execution",
        "Inter-annotator agreement (Cohen's & Fleiss' Kappa)",
        "Automated GitHub Action PR gating",
        "Slack & webhook compliance regression alerts",
        "Team role permissions (Engineers vs Reviewers)",
        "Priority community support",
      ],
      cta: "Start free trial",
      ctaLink: "/login",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For regulated industries (Health, Finance, Legal)",
      features: [
        "Everything in Pro",
        "Out-of-the-box packs: HIPAA §164.312, EU AI Act, FINRA",
        "Air-gapped VPC / On-premise deployment",
        "Custom KMS / HSM cryptographic signing authority",
        "Tamper-evident audit chain exports for regulators",
        "Custom judge rubric calibration & fine-tuning",
        "Dedicated SLA & solutions engineering",
      ],
      cta: "Contact team",
      ctaLink: "mailto:raman@evaldesk.dev",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 px-5">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <span className="section-label">Pricing</span>
          <h2 className="mt-4 text-[28px] font-bold text-[#0a0a0a]" style={{ letterSpacing: "-0.03em" }}>
            Start free, scale when ready
          </h2>
          <p className="mt-2 text-[15px] text-[#8a8f98]" style={{ letterSpacing: "-0.01em" }}>
            Open source forever. Cloud features for teams that need them.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-[#ABC83A] bg-white shadow-lg shadow-[#ABC83A]/10"
                  : "border-black/[0.06] bg-white"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ABC83A] px-3 py-0.5 text-[11px] font-semibold text-[#09090b]">
                  Most popular
                </div>
              )}
              <h3 className="text-[16px] font-semibold text-[#0a0a0a]" style={{ letterSpacing: "-0.02em" }}>{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[32px] font-bold text-[#0a0a0a]" style={{ letterSpacing: "-0.04em" }}>{plan.price}</span>
                {plan.period && <span className="text-[14px] text-[#8a8f98]">{plan.period}</span>}
              </div>
              <p className="mt-1 text-[13px] text-[#8a8f98]">{plan.description}</p>
              <ul className="mt-5 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-[#8a8f98]">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#ABC83A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.ctaLink}
                className={`mt-6 block w-full rounded-lg py-2.5 text-center text-[14px] font-semibold transition-all duration-150 ${
                  plan.highlight
                    ? "bg-[#ABC83A] text-[#09090b] hover:bg-[#9BB82E]"
                    : "border border-black/[0.08] text-[#0a0a0a] hover:bg-black/[0.02]"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
