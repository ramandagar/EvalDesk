"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "What is EvalDesk?", a: "EvalDesk is an open-source evaluation and compliance infrastructure platform for AI agents. It combines automated multi-model LLM-as-a-Judge pipelines (Claude, GPT-4o, DeepSeek) with credentialed human expert verification (physicians, legal counsel, risk analysts) and cryptographically signed audit certificates." },
  { q: "How is EvalDesk different from DeepEval, Braintrust, or Langfuse?", a: "Developer eval libraries like DeepEval and Langfuse are engineer-focused test runners. They don't provide credentialed expert review workflows, disagreement calibration (Cohen's Kappa), or Ed25519-signed audit certificates required for regulatory compliance (HIPAA, FINRA, EU AI Act). EvalDesk bridges both worlds: full Python/TS SDKs for CI/CD, plus a dedicated review workstation for non-engineering experts." },
  { q: "Which LLM judge models are supported?", a: "Anthropic Claude Sonnet & Haiku, OpenAI GPT-4o, DeepSeek, and custom OpenAI-compatible endpoints. You can run multi-model judge ensembles to eliminate single-model bias." },
  { q: "What are Cryptographic Audit Certificates?", a: "When an evaluation run completes and expert sign-offs are submitted, EvalDesk generates a tamper-evident audit report sealed with an asymmetric Ed25519 digital signature and public verification key for compliance auditing." },
  { q: "How do I integrate EvalDesk with CI/CD?", a: "Use our official Python SDK (`pip install evaldesk`), TypeScript SDK (`npm install @evaldesk/sdk`), or our GitHub Action to gate pull requests using automated assertions like `assert_run_passes()`." },
  { q: "Is EvalDesk fully self-hostable?", a: "Yes. EvalDesk is 100% open source under the MIT License. Deploy it in your own VPC with `docker compose up -d`. Zero external telemetry, keeping your proprietary agent logs strictly confidential." },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-5">
        <div className="text-center mb-12">
          <span className="section-label">FAQ</span>
          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-[#0a0a0a]" style={{ letterSpacing: "-0.03em" }}>Frequently asked questions.</h2>
        </div>
        <div>
          {faqs.map((faq, i) => (
            <div key={i} className="border-t border-black/[0.06]">
              <button onClick={() => setOpenIndex(openIndex === i ? null : i)} className="flex w-full items-center justify-between py-4 text-left">
                <span className="text-[14px] font-medium text-[#0a0a0a] pr-4" style={{ letterSpacing: "-0.01em" }}>{faq.q}</span>
                <ChevronDown size={16} className={`shrink-0 text-[#8a8f98] transition-transform ${openIndex === i ? "rotate-180" : ""}`} />
              </button>
              {openIndex === i && <p className="pb-4 text-[13px] leading-relaxed text-[#8a8f98]">{faq.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
