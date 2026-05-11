export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "",
      description: "Get started with basic evaluation capabilities.",
      features: [
        "Up to 3 projects",
        "50 test cases per project",
        "1 team member",
        "Basic LLM Judge",
        "Standard analytics",
        "Community support",
      ],
      cta: "Get Started Free",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: "/mo",
      description: "For teams shipping AI agents at scale.",
      features: [
        "Unlimited projects",
        "Unlimited test cases",
        "Up to 10 team members",
        "Advanced LLM Judge (multi-model)",
        "Full analytics & regression detection",
        "Slack & webhook integrations",
        "Priority support",
      ],
      cta: "Start Pro Trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "$99",
      period: "/mo",
      description: "For organizations with advanced needs.",
      features: [
        "Unlimited everything",
        "Unlimited team members",
        "Custom judge criteria & templates",
        "SSO & advanced roles",
        "Audit log & compliance",
        "Custom integrations",
        "Dedicated support",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  const comparisonFeatures = [
    { name: "Projects", free: "3", pro: "Unlimited", enterprise: "Unlimited" },
    { name: "Test Cases", free: "50/project", pro: "Unlimited", enterprise: "Unlimited" },
    { name: "Team Members", free: "1", pro: "10", enterprise: "Unlimited" },
    { name: "LLM Judge", free: true, pro: true, enterprise: true },
    { name: "Multi-Model Judge", free: false, pro: true, enterprise: true },
    { name: "Analytics", free: "Basic", pro: "Full", enterprise: "Full + Custom" },
    { name: "Integrations", free: false, pro: true, enterprise: true },
    { name: "Custom Judge Templates", free: false, pro: false, enterprise: true },
    { name: "SSO & RBAC", free: false, pro: false, enterprise: true },
    { name: "Audit Log", free: false, pro: false, enterprise: true },
    { name: "Support", free: "Community", pro: "Priority", enterprise: "Dedicated" },
  ];

  const faqs = [
    {
      q: "Can I switch plans at any time?",
      a: "Yes. You can upgrade or downgrade your plan at any time. When upgrading, you will be charged the prorated difference for the remainder of your billing cycle. Downgrades take effect at the start of your next billing cycle.",
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept all major credit cards (Visa, Mastercard, American Express) as well as payments through Stripe. For Enterprise plans, we also support invoicing with NET-30 terms.",
    },
    {
      q: "Is there a free trial for Pro or Enterprise?",
      a: "Both Pro and Enterprise plans come with a 14-day free trial. No credit card is required to start your trial. At the end of the trial period, you can choose to subscribe or continue with the Free plan.",
    },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <section className="pt-24 pb-12 text-center max-w-6xl mx-auto px-5">
        <span className="section-label">Pricing</span>
        <h1
          className="text-[32px] font-semibold text-[#0a0a0a] mt-5"
          style={{ letterSpacing: "-0.03em" }}
        >
          Simple, transparent pricing
        </h1>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 max-w-xl mx-auto">
          Start free, upgrade when you need to. No hidden fees, no surprises.
          Every plan includes core evaluation features.
        </p>
      </section>

      {/* Plan Cards */}
      <section className="pb-20 max-w-6xl mx-auto px-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border bg-white p-6 flex flex-col relative ${
                plan.highlighted
                  ? "border-[#ABC83A] shadow-[0_0_20px_rgba(171,200,58,0.12)]"
                  : "border-black/[0.06]"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-medium bg-[#ABC83A] text-[#0a0a0a]">
                  Most Popular
                </span>
              )}
              <h3 className="text-[15px] font-medium text-[#8a8f98]">
                {plan.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[36px] font-semibold text-[#0a0a0a]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-[14px] text-[#8a8f98]">
                    {plan.period}
                  </span>
                )}
              </div>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed mt-2">
                {plan.description}
              </p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 mt-0.5 text-[#ABC83A] shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-[14px] text-[#0a0a0a]">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`mt-6 w-full ${
                  plan.highlighted ? "btn-primary" : "btn-secondary"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 max-w-6xl mx-auto px-5">
        <h2
          className="text-[32px] font-semibold text-[#0a0a0a] text-center"
          style={{ letterSpacing: "-0.03em" }}
        >
          Full feature comparison
        </h2>
        <div className="mt-10 rounded-xl border border-black/[0.06] overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#fafafa]">
                <th className="text-left py-3 px-5 font-medium text-[#8a8f98]">
                  Feature
                </th>
                <th className="text-center py-3 px-5 font-medium text-[#8a8f98]">
                  Free
                </th>
                <th className="text-center py-3 px-5 font-medium text-[#ABC83A]">
                  Pro
                </th>
                <th className="text-center py-3 px-5 font-medium text-[#8a8f98]">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature, i) => (
                <tr
                  key={feature.name}
                  className={
                    i < comparisonFeatures.length - 1
                      ? "border-b border-black/[0.06]"
                      : ""
                  }
                >
                  <td className="py-3 px-5 text-[#0a0a0a] font-medium">
                    {feature.name}
                  </td>
                  {(["free", "pro", "enterprise"] as const).map((tier) => {
                    const val = feature[tier];
                    return (
                      <td key={tier} className="text-center py-3 px-5">
                        {typeof val === "boolean" ? (
                          val ? (
                            <svg
                              className="w-4 h-4 text-[#ABC83A] mx-auto"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-[#8a8f98] mx-auto opacity-40"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )
                        ) : (
                          <span className="text-[#0a0a0a]">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 max-w-3xl mx-auto px-5">
        <h2
          className="text-[32px] font-semibold text-[#0a0a0a] text-center"
          style={{ letterSpacing: "-0.03em" }}
        >
          Frequently asked questions
        </h2>
        <div className="mt-10 space-y-6">
          {faqs.map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl border border-black/[0.06] bg-white p-5"
            >
              <h3 className="text-[15px] font-semibold text-[#0a0a0a]">
                {faq.q}
              </h3>
              <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-2">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 text-center max-w-6xl mx-auto px-5">
        <h2
          className="text-[32px] font-semibold text-[#0a0a0a]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Ready to start testing?
        </h2>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 max-w-md mx-auto">
          Join thousands of teams evaluating their AI agents with EvalDesk.
        </p>
        <button className="btn-primary mt-6 px-8 py-3 text-[14px]">
          Start testing free
        </button>
      </section>
    </div>
  );
}
