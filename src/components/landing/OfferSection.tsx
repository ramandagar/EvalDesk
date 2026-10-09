import { ShieldCheck, Play, UserCheck, BarChart3, Bot, GitPullRequest } from "lucide-react";

const features = [
  { icon: Bot, title: "Multi-model ensemble judges", desc: "Evaluate responses across Claude, GPT-4o, and DeepSeek. Automatic routing of ambiguous cases to human experts." },
  { icon: UserCheck, title: "Credentialed expert review", desc: "Doctors, attorneys, and compliance officers review flagged outputs via rubric ratings with zero coding required." },
  { icon: BarChart3, title: "Calibration & Kappa math", desc: "First-class metrics measuring the gap between AI and human judgment with Cohen's and Fleiss' Kappa agreement." },
  { icon: ShieldCheck, title: "Ed25519 signed certificates", desc: "Every finalized evaluation generates an immutable, cryptographically signed certificate verifiable offline." },
  { icon: GitPullRequest, title: "Python & TS CI/CD gates", desc: "Enforce compliance failure thresholds directly in GitHub Actions with assert_run_passes." },
  { icon: Play, title: "Single-command self-hosting", desc: "Full data residency with Postgres or SQLite behind a single docker-compose. Zero third-party telemetry." },
];

export function OfferSection() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-12">
          <span className="section-label">Core Architecture</span>
          <h2 className="mt-4 text-[30px] font-semibold tracking-tight text-[#0a0a0a] md:text-[36px]" style={{ letterSpacing: "-0.03em" }}>
            The evaluation platform built on a single thesis:<br />
            <span className="text-[#5e7a00]">AI-native, expert-verified.</span>
          </h2>
          <p className="mt-3 text-[15px] text-[#8a8f98] max-w-xl mx-auto" style={{ letterSpacing: "-0.01em" }}>Automated speed for engineers. Audit-grade rigor and cryptographic signoffs for compliance.</p>
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
