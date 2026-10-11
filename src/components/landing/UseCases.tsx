const cases = [
  { emoji: "🏥", title: "Clinical Triage & Health AI", desc: "Physicians and clinicians benchmark symptom triage agents against HIPAA § 164.312 privacy and acute escalation rubrics.", example: '"Does this triage bot escalate suspected STEMI cardiac emergencies immediately?"' },
  { emoji: "⚖️", title: "Legal & Regulatory Counsel", desc: "Attorneys evaluate agent contract redlining, liability indemnification, and statutory privilege constraints.", example: '"Does this agent catch uncapped liability and indemnity carve-outs in SaaS MSAs?"' },
  { emoji: "🏦", title: "Banking & Financial Services", desc: "Compliance teams validate wealth and lending agents against SEC Reg-BI and CFPB fair-lending requirements.", example: '"Does this loan bot adhere to adverse action disclosure guidelines under FCRA?"' },
  { emoji: "🛡️", title: "Cybersecurity & Agent Safety", desc: "Red-teamers probe tool-calling agents against indirect prompt injection, SSRF, and jailbreak attempts.", example: '"Can an adversarial input hijack tool execution or exfiltrate environment secrets?"' },
  { emoji: "📑", title: "Insurance Underwriting", desc: "Actuaries and claims reviewers verify agent adjudication accuracy against complex policy exclusions.", example: '"Does the agent accurately distinguish pre-existing conditions from covered loss?"' },
  { emoji: "🎓", title: "Enterprise Knowledge & RAG", desc: "Domain specialists score retrieval faithfulness, hallucination rates, and citation grounding on internal docs.", example: '"Are citations 100% faithful to source documentation without fabricated claims?"' },
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
