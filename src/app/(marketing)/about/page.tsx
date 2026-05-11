export default function AboutPage() {
  const team = [
    {
      name: "Arjun Mehta",
      role: "Co-founder & CEO",
      bio: "Previously built ML infrastructure at a Fortune 100 company. Passionate about making AI evaluation accessible to every team.",
      color: "bg-[#ABC83A]",
    },
    {
      name: "Sarah Chen",
      role: "Co-founder & CTO",
      bio: "Former research engineer focused on LLM evaluation benchmarks. Led the development of award-winning NLP tooling at her previous startup.",
      color: "bg-[#4E9363]",
    },
    {
      name: "David Okafor",
      role: "Head of Product",
      bio: "Spent 8 years designing developer tools and platforms. Deeply focused on creating intuitive workflows for complex technical problems.",
      color: "bg-[#9DC1BC]",
    },
  ];

  const values = [
    {
      title: "Open Source First",
      description:
        "We believe the best evaluation tools should be available to everyone. EvalDesk is built in the open, and our core evaluation engine will always be open source. Transparency builds trust.",
      icon: (
        <svg
          className="w-6 h-6 text-[#ABC83A]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
          />
        </svg>
      ),
    },
    {
      title: "Domain Expert Focus",
      description:
        "Generic benchmarks do not capture real-world performance. We build domain-specific evaluation criteria so teams in healthcare, finance, legal, and other fields can test what actually matters.",
      icon: (
        <svg
          className="w-6 h-6 text-[#ABC83A]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
          />
        </svg>
      ),
    },
    {
      title: "Privacy by Design",
      description:
        "Your test cases, agent responses, and evaluation data stay under your control. We never train models on your data, and all sensitive information is encrypted at rest and in transit.",
      icon: (
        <svg
          className="w-6 h-6 text-[#ABC83A]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <section className="pt-24 pb-12 text-center max-w-6xl mx-auto px-5">
        <span className="section-label">About</span>
        <h1
          className="text-[32px] font-semibold text-[#0a0a0a] mt-5"
          style={{ letterSpacing: "-0.03em" }}
        >
          Making AI evaluation accessible to everyone
        </h1>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 max-w-2xl mx-auto">
          We started EvalDesk because we saw teams struggling to answer a simple
          question: is my AI agent actually working correctly?
        </p>
      </section>

      {/* Our Story */}
      <section className="py-20 max-w-3xl mx-auto px-5">
        <h2
          className="text-[32px] font-semibold text-[#0a0a0a]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Our Story
        </h2>
        <div className="mt-6 space-y-5">
          <p className="text-[15px] text-[#8a8f98] leading-relaxed">
            In 2024, our founding team was building AI agents for enterprise
            clients and kept running into the same problem: there was no good
            way to systematically test whether an agent was performing correctly.
            Manual review was slow and inconsistent. Existing benchmarks were too
            generic to be useful for domain-specific applications. Teams were
            shipping agents to production with little confidence in their
            reliability.
          </p>
          <p className="text-[15px] text-[#8a8f98] leading-relaxed">
            We built EvalDesk to solve this. Our platform lets teams create
            test suites tailored to their specific use cases, run evaluations
            automatically with LLM-powered judging, and catch regressions before
            they reach users. Whether you are building a customer support bot,
            a medical triage agent, or a financial advisor, EvalDesk gives you
            the confidence that your AI works as intended.
          </p>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 max-w-6xl mx-auto px-5">
        <h2
          className="text-[32px] font-semibold text-[#0a0a0a] text-center"
          style={{ letterSpacing: "-0.03em" }}
        >
          Meet the team
        </h2>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 text-center max-w-xl mx-auto">
          A small, focused team passionate about building reliable AI.
        </p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {team.map((member) => (
            <div
              key={member.name}
              className="card p-5 flex flex-col items-center text-center"
            >
              <div
                className={`w-16 h-16 rounded-full ${member.color} flex items-center justify-center`}
              >
                <span className="text-white text-[20px] font-semibold">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
              </div>
              <h3 className="text-[15px] font-semibold text-[#0a0a0a] mt-4">
                {member.name}
              </h3>
              <p className="text-[13px] text-[#ABC83A] font-medium mt-1">
                {member.role}
              </p>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed mt-3">
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="py-20 max-w-6xl mx-auto px-5">
        <h2
          className="text-[32px] font-semibold text-[#0a0a0a] text-center"
          style={{ letterSpacing: "-0.03em" }}
        >
          What we believe
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {values.map((value) => (
            <div key={value.title} className="card p-5">
              <div className="w-10 h-10 rounded-lg bg-[#ABC83A]/10 flex items-center justify-center">
                {value.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-[#0a0a0a] mt-4">
                {value.title}
              </h3>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed mt-2">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center max-w-6xl mx-auto px-5">
        <h2
          className="text-[32px] font-semibold text-[#0a0a0a]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Join us on this mission
        </h2>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 max-w-md mx-auto">
          Start evaluating your AI agents today. It takes less than 5 minutes
          to set up your first test suite.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button className="btn-primary px-8 py-3 text-[14px]">
            Get started free
          </button>
          <button className="btn-secondary px-8 py-3 text-[14px]">
            Read the docs
          </button>
        </div>
      </section>
    </div>
  );
}
