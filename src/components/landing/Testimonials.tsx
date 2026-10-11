const guarantees = [
  {
    tag: "Regulatory Integrity",
    title: "EU AI Act & HIPAA Compliant",
    desc: "Designed from first principles around Article 14 (Human Oversight) and HIPAA Security Rule (§ 164.312). Turn non-deterministic agent outputs into audit-grade compliance artifacts.",
    badge: "Article 14 Ready",
  },
  {
    tag: "Mathematical Rigor",
    title: "Inter-Annotator Calibration",
    desc: "Calculate Cohen's and Fleiss' Kappa statistics between LLM judges and human experts. Never deploy an AI judge that fails to correlate with ground-truth expert consensus.",
    badge: "Kappa > 0.85 Target",
  },
  {
    tag: "Cryptographic Security",
    title: "Ed25519 Tamper-Proof Audit Seals",
    desc: "Every evaluation run and sign-off decision is digitally sealed with asymmetric cryptographic signatures and public verification keys, ready for third-party regulatory inspection.",
    badge: "Zero-Knowledge Verify",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 border-t border-black/[0.06]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-12">
          <span className="section-label">Architecture</span>
          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-[#0a0a0a]" style={{ letterSpacing: "-0.03em" }}>
            Engineered for high-stakes AI validation
          </h2>
          <p className="mt-2 text-[15px] text-[#8a8f98] max-w-lg mx-auto" style={{ letterSpacing: "-0.01em" }}>
            Moving evaluation beyond brittle unit tests into verifiable, audit-ready compliance infrastructure.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {guarantees.map((g, i) => (
            <div key={i} className="rounded-xl border border-black/[0.06] bg-[#fafafa]/50 p-6 flex flex-col justify-between hover:border-black/[0.12] transition-all duration-200">
              <div>
                <span className="inline-block rounded-md bg-[#ABC83A]/20 px-2.5 py-1 text-[11px] font-medium text-[#485d10] mb-3">
                  {g.tag}
                </span>
                <h3 className="text-[16px] font-semibold text-[#0a0a0a] mb-2" style={{ letterSpacing: "-0.01em" }}>
                  {g.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-[#8a8f98]">
                  {g.desc}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-black/[0.04]">
                <span className="text-[12px] font-mono text-[#0a0a0a] bg-black/[0.04] px-2 py-0.5 rounded">
                  {g.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
