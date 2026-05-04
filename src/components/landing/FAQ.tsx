"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "What is EvalDesk?", a: "An open-source evaluation tool for AI agents. Domain experts test and rate AI answers without writing code. Write questions in plain English, run them against your agent, and rate the responses." },
  { q: "How is this different from DeepEval or Langfuse?", a: "DeepEval and Langfuse require Python scripts and JSON datasets — they're built for engineers. EvalDesk is built for domain experts who actually know if an AI answer is correct." },
  { q: "Is it really free?", a: "Yes. MIT-licensed open source. Self-host it for free, forever. Your data stays on your servers." },
  { q: "How do I self-host it?", a: "Run `docker compose up -d` and open localhost:3000. That's it. Works with SQLite out of the box." },
  { q: "What agents can I test?", a: "Any AI agent with an HTTP endpoint. Paste the URL and optionally add an API key." },
  { q: "What is LLM-as-Judge?", a: "An optional feature using GPT-4 to auto-rate answers before human review, saving hours of review time." },
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
