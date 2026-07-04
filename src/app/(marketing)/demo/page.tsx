"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SampleResult {
  resultId: string;
  title: string;
  input: string;
  expectedOutput: string | null;
  category: string | null;
  agentResponse: string | null;
  aiLabel: string | null;
  aiConfidence: number | null;
  finalLabel: string | null;
}

interface ControlCoverage {
  id: string;
  title: string;
  covered: boolean;
  total: number;
  passed: number;
  passRate: number;
  gate: number;
  status: "pass" | "fail" | "uncovered";
}

interface DemoData {
  run: {
    id: string;
    projectName: string;
    status: string;
    totalCases: number;
    passCount: number;
    failCount: number;
    partialCount: number;
    unratedCount: number;
    passRate: number | null;
  };
  results: SampleResult[];
  certificate: {
    id: string;
    contentHash: string;
    signature: string;
    algo: string;
    signedAt: number;
  } | null;
  coverage: {
    suiteId: string;
    controls: ControlCoverage[];
    controlsCovered: number;
    controlsTotal: number;
    controlsPassed: number;
    compliant: boolean;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LabelBadge({ label }: { label: string | null }) {
  const map: Record<string, string> = {
    pass: "bg-[#e8f5e9] text-[#1b5e20]",
    fail: "bg-[#fdecea] text-[#b71c1c]",
    partial: "bg-[#fff8e1] text-[#795900]",
  };
  const cls = map[label ?? ""] ?? "bg-[#f5f5f5] text-[#9e9e9e]";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${cls}`}>
      {label === "pass" ? "✓" : label === "fail" ? "✗" : label === "partial" ? "~" : "—"}
      {label ?? "unrated"}
    </span>
  );
}

function CoverageStatusDot({ status }: { status: ControlCoverage["status"] }) {
  const map = {
    pass: "bg-[#4caf50]",
    fail: "bg-[#ef5350]",
    uncovered: "bg-[#bdbdbd]",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[status]}`} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [data, setData] = useState<DemoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch(() => setError("Failed to load demo data."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <title>Live Demo — EvalDesk</title>
      <meta
        name="description"
        content="See a real HIPAA compliance evaluation run — pass/fail verdicts, AI scores, human review, signed certificate, and coverage matrix."
      />

      <div className="max-w-4xl mx-auto px-5 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <span
            className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest uppercase mb-5"
            style={{ background: "rgba(171,200,58,0.12)", color: "#5a7a00" }}
          >
            Live Demo
          </span>
          <h1
            className="text-[36px] font-semibold text-[#0a0a0a] leading-tight"
            style={{ letterSpacing: "-0.03em" }}
          >
            A real HIPAA compliance eval —{" "}
            <span style={{ color: "#ABC83A" }}>from run to signed certificate</span>
          </h1>
          <p className="mt-4 text-[16px] text-[#8a8f98] leading-relaxed max-w-2xl mx-auto">
            5 test cases tagged with HIPAA controls. An AI judge scores each
            answer. A clinician reviews. The certificate is Ed25519-signed and
            offline-verifiable.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-[#8a8f98] text-[15px]">
            Loading demo…
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-[#ffd5d5] bg-[#fff5f5] p-6 text-center">
            <p className="text-[15px] text-[#b71c1c] font-medium">{error}</p>
            <code className="block mt-2 text-[13px] text-[#8a8f98]">npm run seed</code>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── Run summary ─────────────────────────────────────────────── */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[18px] font-semibold text-[#0a0a0a]">
                  {data.run.projectName}
                </h2>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    data.run.status === "signed"
                      ? "bg-[#e8f5e9] text-[#1b5e20]"
                      : "bg-[#f5f5f5] text-[#616161]"
                  }`}
                >
                  {data.run.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total cases", value: data.run.totalCases, color: "#0a0a0a" },
                  { label: "Passed", value: data.run.passCount, color: "#2e7d32" },
                  { label: "Failed", value: data.run.failCount, color: "#c62828" },
                  { label: "Pass rate", value: data.run.passRate != null ? `${data.run.passRate}%` : "—", color: "#ABC83A" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-black/[0.06] p-5 text-center"
                  >
                    <p className="text-[28px] font-semibold" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="text-[12px] text-[#8a8f98] mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Sample results ──────────────────────────────────────────── */}
            <section className="mb-10">
              <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-4">
                Sample results
              </h2>
              <div className="space-y-4">
                {data.results.map((r) => (
                  <div
                    key={r.resultId}
                    className="rounded-xl border border-black/[0.06] bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#0a0a0a]">{r.title}</p>
                        {r.category && (
                          <span className="mt-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#f5f5f5] text-[#616161] font-mono">
                            {r.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.aiLabel && (
                          <span className="text-[11px] text-[#8a8f98]">
                            AI{r.aiConfidence != null ? ` ${(r.aiConfidence * 100).toFixed(0)}%` : ""}
                          </span>
                        )}
                        <LabelBadge label={r.finalLabel ?? r.aiLabel} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-[#fafafa] p-3 border border-black/[0.04]">
                        <p className="text-[11px] text-[#8a8f98] font-medium mb-1 uppercase tracking-wider">Input</p>
                        <p className="text-[13px] text-[#0a0a0a] leading-relaxed">{r.input}</p>
                      </div>
                      <div className="rounded-lg bg-[#fafafa] p-3 border border-black/[0.04]">
                        <p className="text-[11px] text-[#8a8f98] font-medium mb-1 uppercase tracking-wider">Agent response</p>
                        <p className="text-[13px] text-[#0a0a0a] leading-relaxed">{r.agentResponse ?? "—"}</p>
                      </div>
                    </div>

                    {r.expectedOutput && (
                      <div className="mt-2 rounded-lg bg-[#f9fbe7] p-3 border border-[#f0f4c3]">
                        <p className="text-[11px] text-[#8a8f98] font-medium mb-1 uppercase tracking-wider">Expected</p>
                        <p className="text-[13px] text-[#33691e] leading-relaxed">{r.expectedOutput}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── HIPAA coverage matrix ───────────────────────────────────── */}
            {data.coverage && (
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-[18px] font-semibold text-[#0a0a0a]">
                    HIPAA coverage matrix
                  </h2>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      data.coverage.compliant
                        ? "bg-[#e8f5e9] text-[#1b5e20]"
                        : "bg-[#fdecea] text-[#b71c1c]"
                    }`}
                  >
                    {data.coverage.compliant ? "Compliant" : "Non-compliant"}
                  </span>
                </div>
                <p className="text-[13px] text-[#8a8f98] mb-4">
                  {data.coverage.controlsPassed}/{data.coverage.controlsTotal} controls passing
                  · {data.coverage.controlsCovered} covered
                </p>
                <div className="rounded-xl border border-black/[0.06] overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#fafafa] border-b border-black/[0.06]">
                        <th className="text-left py-2.5 px-4 font-medium text-[#8a8f98]">Control</th>
                        <th className="text-left py-2.5 px-4 font-medium text-[#8a8f98]">Cases</th>
                        <th className="text-left py-2.5 px-4 font-medium text-[#8a8f98]">Pass rate</th>
                        <th className="text-left py-2.5 px-4 font-medium text-[#8a8f98]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coverage.controls.map((ctrl, i) => (
                        <tr
                          key={ctrl.id}
                          className={i < data.coverage!.controls.length - 1 ? "border-b border-black/[0.04]" : ""}
                        >
                          <td className="py-3 px-4">
                            <p className="font-medium text-[#0a0a0a]">{ctrl.title}</p>
                            <p className="text-[11px] text-[#8a8f98] font-mono mt-0.5">{ctrl.id}</p>
                          </td>
                          <td className="py-3 px-4 text-[#0a0a0a]">
                            {ctrl.covered ? `${ctrl.passed}/${ctrl.total}` : "—"}
                          </td>
                          <td className="py-3 px-4">
                            {ctrl.covered ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-24 rounded-full bg-[#f0f0f0] overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${ctrl.passRate * 100}%`,
                                      background: ctrl.passRate >= ctrl.gate ? "#4caf50" : "#ef5350",
                                    }}
                                  />
                                </div>
                                <span className="text-[12px] text-[#616161]">
                                  {(ctrl.passRate * 100).toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#bdbdbd]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <CoverageStatusDot status={ctrl.status} />
                              <span
                                className={`capitalize ${
                                  ctrl.status === "pass"
                                    ? "text-[#2e7d32]"
                                    : ctrl.status === "fail"
                                    ? "text-[#c62828]"
                                    : "text-[#9e9e9e]"
                                }`}
                              >
                                {ctrl.status}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Certificate ─────────────────────────────────────────────── */}
            {data.certificate ? (
              <section className="mb-12">
                <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-4">
                  Signed certificate
                </h2>
                <div className="rounded-xl border border-[#e8f5e9] bg-[#f9fbe7] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-[14px] font-semibold text-[#2e7d32]">
                      {data.certificate.algo} — Ed25519 signed
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] font-medium text-[#8a8f98] uppercase tracking-wider mb-1">Content hash (SHA-256)</p>
                      <code className="block text-[12px] text-[#1b5e20] font-mono break-all bg-white/70 px-3 py-2 rounded-lg border border-[#c8e6c9]">
                        {data.certificate.contentHash}
                      </code>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[#8a8f98] uppercase tracking-wider mb-1">Signature (first 80 chars)</p>
                      <code className="block text-[12px] text-[#1b5e20] font-mono break-all bg-white/70 px-3 py-2 rounded-lg border border-[#c8e6c9]">
                        {data.certificate.signature.slice(0, 80)}…
                      </code>
                    </div>
                    <p className="text-[12px] text-[#8a8f98]">
                      Signed at{" "}
                      {new Date(data.certificate.signedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section className="mb-12">
                <div className="rounded-xl border border-black/[0.06] bg-[#fafafa] p-5 text-center text-[14px] text-[#8a8f98]">
                  Certificate not yet generated for this run.
                </div>
              </section>
            )}
          </>
        )}

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <div className="mt-4 rounded-2xl border border-black/[0.06] bg-[#fafafa] p-10 text-center">
          <h2
            className="text-[24px] font-semibold text-[#0a0a0a]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Ready to run your own eval?
          </h2>
          <p className="mt-3 text-[15px] text-[#8a8f98] max-w-md mx-auto leading-relaxed">
            Connect your agent, add test cases, invite your compliance team. Get
            a signed certificate in minutes.
          </p>
          <Link
            href="/login"
            id="demo-cta-signup"
            className="inline-block mt-6 px-8 py-3 rounded-lg text-[14px] font-semibold text-white"
            style={{ background: "#ABC83A" }}
          >
            Sign up — it's free →
          </Link>
        </div>
      </div>
    </>
  );
}
