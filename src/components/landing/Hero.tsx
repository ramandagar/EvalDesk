"use client";
import Link from "next/link";

export function Hero() {
  return (
    <section className="pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.02] px-4 py-1.5 text-[12px] text-[#8a8f98]" style={{ letterSpacing: "-0.01em" }}>
            <span className="text-[#4E9363] font-medium">Open source</span> · Self-hostable · No code required
          </div>
        </div>
        <h1 className="text-center text-[40px] font-semibold leading-[1.08] tracking-tight text-[#0a0a0a] md:text-[56px] lg:text-[64px]" style={{ letterSpacing: "-0.03em" }}>
          Test your AI agents<br /><span className="text-gradient">without writing code</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-center text-[16px] leading-relaxed text-[#8a8f98] md:text-[18px]" style={{ letterSpacing: "-0.01em" }}>
          Let your domain experts — doctors, lawyers, teachers — validate AI output with a simple rating interface. No JSON. No Python. No engineering required.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/login" className="btn-primary text-[14px] px-6 py-3">Start testing free</Link>
          <a href="https://github.com/evaldesk/evaldesk" target="_blank" rel="noopener noreferrer" className="btn-secondary text-[14px] px-6 py-3 flex items-center gap-2">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            Star on GitHub
          </a>
        </div>

        {/* Product mockup */}
        <div className="mt-14 mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.02] shadow-2xl shadow-black/[0.06]">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-white px-4 py-2.5">
              <div className="h-[7px] w-[7px] rounded-full bg-[#ff5f57]" />
              <div className="h-[7px] w-[7px] rounded-full bg-[#febc2e]" />
              <div className="h-[7px] w-[7px] rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11px] text-[#8a8f98]" style={{ letterSpacing: "-0.01em" }}>EvalDesk — Dashboard</span>
            </div>
            {/* Mock dashboard */}
            <div className="flex min-h-[280px]">
              {/* Sidebar mock */}
              <div className="w-36 border-r border-black/[0.06] bg-white p-3 space-y-2 hidden sm:block">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="h-5 w-5 rounded bg-[#ABC83A] flex items-center justify-center"><span className="text-[8px] font-bold text-[#09090b]">E</span></div>
                  <span className="text-[11px] font-semibold text-[#0a0a0a]" style={{ letterSpacing: "-0.01em" }}>EvalDesk</span>
                </div>
                {["Dashboard", "Projects", "All Runs", "Compare", "Analytics"].map((item, i) => (
                  <div key={item} className={`text-[10px] px-1.5 py-1 rounded ${i === 0 ? "bg-[#ABC83A]/10 text-[#0a0a0a] font-medium" : "text-[#8a8f98]"}`}>{item}</div>
                ))}
              </div>
              {/* Main content mock */}
              <div className="flex-1 p-4 space-y-3">
                {/* Stat cards */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Projects", value: "4", color: "#ABC83A" },
                    { label: "Runs", value: "7", color: "#6FA3A5" },
                    { label: "Pass rate", value: "65%", color: "#4E9363" },
                    { label: "Cases", value: "15", color: "#6D75A6" },
                  ].map(c => (
                    <div key={c.label} className="rounded-lg border border-black/[0.06] bg-white p-2">
                      <p className="text-[14px] font-bold text-[#0a0a0a]">{c.value}</p>
                      <p className="text-[8px] text-[#8a8f98]">{c.label}</p>
                    </div>
                  ))}
                </div>
                {/* Chart mock */}
                <div className="rounded-lg border border-black/[0.06] bg-white p-3">
                  <p className="text-[9px] font-medium text-[#0a0a0a] mb-2">Pass Rate Trend</p>
                  <div className="flex items-end gap-1 h-16">
                    {[35, 50, 45, 65, 72, 60, 80, 78, 85, 67].map((v, i) => (
                      <div key={i} className="flex-1 rounded-t bg-[#ABC83A]/30 relative" style={{height:`${v}%`}}>
                        <div className="absolute bottom-0 left-0 right-0 rounded-t bg-[#ABC83A]" style={{height:`${v * 0.6}%`}} />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Run list mock */}
                <div className="space-y-1.5">
                  {["Medical Triage Bot — 80%", "Legal Contract — 67%", "Support Bot — Pending"].map(r => (
                    <div key={r} className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${r.includes("80") ? "bg-[#4E9363]" : r.includes("67") ? "bg-amber-400" : "bg-[#8a8f98]/30"}`} />
                      <span className="text-[10px] text-[#0a0a0a] flex-1">{r.split(" — ")[0]}</span>
                      <span className={`text-[10px] font-medium ${r.includes("80") ? "text-[#4E9363]" : r.includes("67") ? "text-amber-500" : "text-[#8a8f98]"}`}>{r.split(" — ")[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[12px] text-[#8a8f98]" style={{ letterSpacing: "-0.01em" }}>Live dashboard with demo data — yours in 30 seconds</p>
        </div>
      </div>
    </section>
  );
}
