const testimonials = [
  { quote: "Our compliance team finally has a way to validate our banking chatbot without filing a Jira ticket every time.", name: "Sarah Chen", role: "CTO, FinBot" },
  { quote: "I'm a doctor, not a developer. EvalDesk lets me review our triage AI's answers directly. This should have existed years ago.", name: "Dr. Arjun Mehta", role: "Head of AI, MedTriage" },
  { quote: "We went from 0 to 200 test cases rated by our legal team in one afternoon. No training needed.", name: "Mike Rodriguez", role: "VP Engineering, LegalAI" },
];

export function Testimonials() {
  return (
    <section className="py-20 border-t border-black/[0.06]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-12">
          <span className="section-label">Testimonials</span>
          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-[#0a0a0a]" style={{ letterSpacing: "-0.03em" }}>Trusted by teams building AI</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-xl border border-black/[0.06] p-5">
              <p className="text-[13px] leading-relaxed text-[#8a8f98]">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4"><p className="text-[13px] font-medium text-[#0a0a0a]">{t.name}</p><p className="text-[12px] text-[#8a8f98]">{t.role}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
