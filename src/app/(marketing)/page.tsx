import Link from "next/link";
import { Bot, UserCheck, BadgeCheck, ShieldCheck, BarChart3, GitBranch, Server, Lock, ArrowRight, Check } from "lucide-react";

export default function Home() {
  return (
    <div className="bg-white dark:bg-[#09090b]">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ABC83A]/[0.07] to-transparent" />
        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1 mb-6 text-[12px] font-medium text-[#5e7a00] dark:text-[#ABC83A]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ABC83A]" />
            Open source · MIT licensed · Self-hostable
          </div>
          <h1 className="text-[44px] md:text-[56px] font-bold tracking-[-0.03em] leading-[1.05] text-[#09090b] dark:text-white mb-6">
            Prove your AI is safe.
          </h1>
          <p className="text-[18px] md:text-[20px] text-[#62666d] dark:text-[#8a8f98] max-w-2xl mx-auto leading-relaxed mb-10">
            AI judges every answer. A credentialed expert verifies the risky ones.
            You get a cryptographically signed certificate an auditor accepts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#ABC83A] px-6 py-3 text-[15px] font-semibold text-[#09090b] hover:bg-[#9ab430] transition-colors">
              Try the demo <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/15 px-6 py-3 text-[15px] font-semibold text-[#09090b] dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
              Sign up free
            </Link>
          </div>
          <p className="mt-6 text-[13px] text-[#8a8f98]">No credit card. Self-host with one command.</p>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────── */}
      <section className="border-y border-black/[0.06] dark:border-white/[0.06] py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[15px] text-[#8a8f98] dark:text-[#62666d] leading-relaxed">
            Compliance asks one question: <span className="font-semibold text-[#09090b] dark:text-white">prove it&apos;s safe.</span>
            {" "}DeepEval catches regressions. Langfuse traces calls.
            {" "}<span className="font-semibold text-[#09090b] dark:text-white">Neither produces a record an auditor accepts.</span>
          </p>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-[28px] font-bold tracking-tight text-center text-[#09090b] dark:text-white mb-3">
            How it works
          </h2>
          <p className="text-[15px] text-[#8a8f98] text-center mb-16">Three layers. No code required.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <StepCard icon={<Bot size={22} />} step="01" title="AI Judge" desc="Scores every agent answer in seconds. Any model — DeepSeek, OpenAI, Ollama, your own endpoint." />
            <StepCard icon={<UserCheck size={22} />} step="02" title="Expert Review" desc="Uncertain cases route to a doctor, lawyer, or compliance officer. Blind, keyboard-first, 50 cases in 10 minutes." />
            <StepCard icon={<BadgeCheck size={22} />} step="03" title="Signed Certificate" desc="Ed25519-signed, offline-verifiable. Hand the JSON to an auditor. Zero callback to EvalDesk." />
          </div>
        </div>
      </section>

      {/* ── Moat ─────────────────────────────────────────────── */}
      <section className="bg-[#09090b] py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-[28px] font-bold tracking-tight text-white text-center mb-3">
            What nobody else has
          </h2>
          <p className="text-[15px] text-[#62666d] text-center mb-16">Four things no competitor ships in one product.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <MoatCard icon={<BarChart3 size={18} />} title="Agreement math" desc="Cohen's κ + calibration. Measures how much your AI judge agrees with a real expert. The gap is quantified, not vibes." />
            <MoatCard icon={<ShieldCheck size={18} />} title="Compliance packs" desc="HIPAA + EU-AI-Act controls mapped to your evals. Coverage matrix flows into the signed certificate." />
            <MoatCard icon={<Lock size={18} />} title="Self-host, zero egress" desc="One docker compose up. Postgres + app + worker. Your data never leaves your server." />
            <MoatCard icon={<GitBranch size={18} />} title="Developer surface" desc="TypeScript + Python SDKs, GitHub Action, REST API, signed webhooks. CI-ready." />
          </div>
        </div>
      </section>

      {/* ── Code snippet ─────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-[24px] font-bold tracking-tight text-center text-[#09090b] dark:text-white mb-3">
            Gate CI on pass rate
          </h2>
          <p className="text-[14px] text-[#8a8f98] text-center mb-8">Your eval runs on every PR. Fail the build if accuracy drops.</p>
          <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#09090b] dark:bg-black/40 overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] text-[#62666d] font-mono">eval.py</span>
            </div>
            <pre className="p-5 text-[13px] leading-relaxed font-mono text-[#e0e0e0] overflow-x-auto"><code>{`from evaldesk import EvalDesk, assert_run_passes

client = EvalDesk("https://app.evaldesk.dev", token, org)
run = client.runs.create(project_id="med-triage")
run = client.runs.wait(run["id"])

assert_run_passes(run, min_pass_rate=0.9)`}</code></pre>
          </div>
        </div>
      </section>

      {/* ── Feature list ─────────────────────────────────────── */}
      <section className="border-t border-black/[0.06] dark:border-white/[0.06] py-16">
        <div className="max-w-3xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            {[
              "RAG citation faithfulness (hallucination detection)",
              "Safety probes (jailbreak, prompt injection, PII leak)",
              "Cost + latency tracking per test case",
              "Blind review (server-enforced, not DOM-hidden)",
              "Append-only verdicts (idempotent, tamper-evident)",
              "Per-project judge (any OpenAI-compatible model)",
              "Audit hash chain (every action, verifiable)",
              "API keys + signed webhooks",
            ].map((f) => (
              <div key={f} className="flex items-start gap-2.5">
                <Check size={16} className="text-[#ABC83A] mt-0.5 shrink-0" />
                <span className="text-[14px] text-[#3d3d3d] dark:text-[#a0a0a0]">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-[32px] font-bold tracking-tight text-[#09090b] dark:text-white mb-4">
            Ship AI your auditor trusts.
          </h2>
          <p className="text-[16px] text-[#8a8f98] mb-8">
            Connect your agent, invite your compliance team, get a signed certificate in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#ABC83A] px-6 py-3 text-[15px] font-semibold text-[#09090b] hover:bg-[#9ab430] transition-colors">
              Try the demo <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/15 px-6 py-3 text-[15px] font-semibold text-[#09090b] dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
              Get started
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-[12px] text-[#8a8f98]">
            <span className="flex items-center gap-1.5"><Server size={13} /> docker compose up</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> MIT licensed</span>
            <span className="flex items-center gap-1.5"><GitBranch size={13} /> github.com/ramandagar/EvalDesk</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({ icon, step, title, desc }: { icon: React.ReactNode; step: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-6 hover:border-[#ABC83A]/30 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ABC83A]/10 text-[#5e7a00] dark:text-[#ABC83A]">
          {icon}
        </div>
        <span className="text-[12px] font-mono text-[#8a8f98]">{step}</span>
      </div>
      <h3 className="text-[16px] font-semibold text-[#09090b] dark:text-white mb-2">{title}</h3>
      <p className="text-[14px] text-[#62666d] dark:text-[#8a8f98] leading-relaxed">{desc}</p>
    </div>
  );
}

function MoatCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-[#ABC83A]">{icon}</span>
        <h3 className="text-[15px] font-semibold text-white">{title}</h3>
      </div>
      <p className="text-[14px] text-[#8a8f98] leading-relaxed">{desc}</p>
    </div>
  );
}
