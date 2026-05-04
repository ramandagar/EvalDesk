const cases = [
  { emoji: "🏥", title: "Healthcare", desc: "Doctors validate triage bots and diagnostic assistants.", example: '"Does this bot correctly identify cardiac emergencies?"' },
  { emoji: "⚖️", title: "Legal", desc: "Lawyers test contract review agents and legal research tools.", example: '"Does this agent identify liability clauses?"' },
  { emoji: "🎓", title: "Education", desc: "Teachers evaluate AI tutors and grading assistants.", example: '"Does this math tutor explain correctly for 8th graders?"' },
  { emoji: "🏦", title: "Finance", desc: "Compliance teams validate loan advisory bots.", example: '"Does this bot correctly explain loan terms?"' },
  { emoji: "🛡️", title: "Insurance", desc: "Claims reviewers verify AI agents process claims accurately.", example: '"Does this agent categorize claim severity correctly?"' },
  { emoji: "💬", title: "Customer Support", desc: "PMs test support bots for accuracy, tone, and helpfulness.", example: '"Does this bot handle refunds per company policy?"' },
];

export function UseCases() {
  return (
    <section id="use-cases" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-12">
          <span className="section-label">Use cases</span>
          <h2 className="mt-4 text-[30px] font-semibold tracking-tight text-[#0a0a0a] md:text-[36px]" style={{ letterSpacing: "-0.03em" }}>Powering every type of AI evaluation</h2>
          <p className="mt-3 text-[15px] text-[#8a8f98] max-w-lg mx-auto" style={{ letterSpacing: "-0.01em" }}>From medical diagnosis to legal contract review.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c, i) => (
            <div key={i} className="rounded-xl border border-black/[0.06] p-5 hover:border-black/[0.12] transition-all duration-200">
              <span className="text-2xl">{c.emoji}</span>
              <h3 className="mt-3 text-[14px] font-semibold text-[#0a0a0a]" style={{ letterSpacing: "-0.01em" }}>{c.title}</h3>
              <p className="mt-1 text-[13px] text-[#8a8f98] leading-relaxed">{c.desc}</p>
              <p className="mt-3 text-[12px] text-[#4E9363] italic">{c.example}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
