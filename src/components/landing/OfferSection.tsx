import { MessageSquare, Play, ThumbsUp, BarChart3, Bot, Users } from "lucide-react";

const features = [
  { icon: MessageSquare, title: "Plain English test cases", desc: "Write questions in normal text. Describe what a good answer looks like. No JSON, no code." },
  { icon: Play, title: "One-click agent testing", desc: "Paste your agent's URL, hit Run. EvalDesk sends every test case and captures every response." },
  { icon: ThumbsUp, title: "Human rating interface", desc: "Rate each answer as Pass, Fail, or Partial with keyboard shortcuts. Fly through 50 cases in 10 min." },
  { icon: BarChart3, title: "Quality dashboard", desc: "Track pass rate over time, spot regressions, see worst-performing test cases." },
  { icon: Bot, title: "LLM-as-Judge", desc: "Optional auto-scoring with GPT-4. Pre-rate answers so humans only check disputed cases." },
  { icon: Users, title: "Team collaboration", desc: "Invite doctors, lawyers, PMs by email. They rate answers in their browser. No GitHub needed." },
];

export function OfferSection() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-12">
          <span className="section-label">What we offer</span>
          <h2 className="mt-4 text-[30px] font-semibold tracking-tight text-[#0a0a0a] md:text-[36px]" style={{ letterSpacing: "-0.03em" }}>
            It&apos;s not evals for your engineers.<br />It&apos;s evals for your experts.
          </h2>
          <p className="mt-3 text-[15px] text-[#8a8f98] max-w-lg mx-auto" style={{ letterSpacing: "-0.01em" }}>Built for domain experts first, engineers second.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="rounded-xl border border-black/[0.06] p-5 hover:border-black/[0.12] hover:shadow-sm transition-all duration-200">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#ABC83A]/10">
                <f.icon className="h-4 w-4 text-[#ABC83A]" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] mb-1" style={{ letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-[#8a8f98]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
