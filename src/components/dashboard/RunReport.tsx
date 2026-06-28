"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, ShieldCheck, Download, FileCode, FileText, FileJson } from "lucide-react";
import { api, downloadReport, type Run } from "@/lib/client/api";
import { Page, PageHeader, Spinner, ErrorBanner, Card, StatusBadge } from "./kit";

interface ResultItem {
  resultId: string;
  title: string;
  input: string;
  expectedOutput: string | null;
  agentResponse: string | null;
  status: string;
  needsHuman: boolean;
  aiScores: Array<{ model: string; label: string; score: number | null; confidence: number | null; disagreement: number | null }>;
  humanRatings: Array<{ reviewerId: string | null; label: string; rationale: string | null }>;
  finalLabel: string | null;
}

const LABEL_CLS: Record<string, string> = {
  pass: "text-[#5e7a00] bg-[#ABC83A]/15 border-[#ABC83A]/30",
  fail: "text-red-600 bg-red-500/10 border-red-500/20",
  partial: "text-amber-600 bg-amber-500/10 border-amber-500/20",
};
function LabelPill({ label }: { label: string | null }) {
  if (!label) return <span className="text-[11px] text-[#8a8f98]">—</span>;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${LABEL_CLS[label] ?? "text-neutral-500 bg-neutral-500/10 border-neutral-500/20"}`}>{label}</span>;
}

export function RunReport({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get<{ run: Run; results: ResultItem[] }>(`/runs/${runId}/results`)
      .then((d) => { setRun(d.run); setResults(d.results); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [runId]);

  // poll while in flight
  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    const t = setInterval(() => {
      api.get<{ run: Run; results: ResultItem[] }>(`/runs/${runId}/results`).then((d) => { setRun(d.run); setResults(d.results); }).catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, [run, runId]);

  if (loading) return <Page><Spinner /></Page>;
  if (!run) return <Page><ErrorBanner message={error ?? "Run not found"} /></Page>;

  function toggle(id: string) {
    setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function download(format: "html" | "csv" | "json") {
    setMenuOpen(false);
    setDownloading(true);
    try {
      await downloadReport(runId, format);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Page>
      <Link href={`/projects/${run.projectId}`} className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"><ArrowLeft size={14} /> Project</Link>
      <PageHeader
        title="Run report"
        subtitle={`${run.totalCases} cases`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={run.status} />
            {run.unratedCount > 0 && <Link href={`/review/${run.id}`} className="text-[13px] font-medium text-[#5e7a00] hover:underline">Review {run.unratedCount} →</Link>}
            {run.status === "signed" && <Link href={`/runs/${run.id}/certificate`} className="inline-flex items-center gap-1 text-[13px] font-medium text-indigo-600 hover:underline"><ShieldCheck size={14} /> Certificate</Link>}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((s) => !s)}
                disabled={downloading || results.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.1] px-3 py-1.5 text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] disabled:opacity-50"
              >
                <Download size={14} /> {downloading ? "Preparing…" : "Download"}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#16161a] shadow-lg py-1">
                    <button onClick={() => download("html")} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"><FileCode size={14} className="text-[#8a8f98]" /> HTML report</button>
                    <button onClick={() => download("csv")} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"><FileText size={14} className="text-[#8a8f98]" /> CSV</button>
                    <button onClick={() => download("json")} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"><FileJson size={14} className="text-[#8a8f98]" /> JSON</button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat label="Pass" value={run.passCount} cls="text-[#5e7a00]" />
        <Stat label="Fail" value={run.failCount} cls="text-red-600" />
        <Stat label="Partial" value={run.partialCount} cls="text-amber-600" />
        <Stat label="To review" value={run.unratedCount} cls="text-[#0a0a0a] dark:text-[#f7f8f8]" />
      </div>

      <Card>
        <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
          {results.map((r) => {
            const isOpen = open.has(r.resultId);
            return (
              <li key={r.resultId}>
                <button onClick={() => toggle(r.resultId)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isOpen ? <ChevronDown size={15} className="shrink-0 text-[#8a8f98]" /> : <ChevronRight size={15} className="shrink-0 text-[#8a8f98]" />}
                    <span className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">{r.title || r.input.slice(0, 40)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.aiScores[0] && <span className="text-[11px] text-[#8a8f98]">AI: {r.aiScores.map((s) => s.label).join("/")}</span>}
                    {r.needsHuman && !r.finalLabel && <span className="text-[11px] text-amber-600">needs review</span>}
                    <LabelPill label={r.finalLabel ?? r.aiScores[0]?.label ?? null} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-11 space-y-3 text-[13px]">
                    <Field label="Input">{r.input}</Field>
                    {r.expectedOutput && <Field label="Expected">{r.expectedOutput}</Field>}
                    <Field label="Agent response">{r.agentResponse ?? <em className="text-[#8a8f98]">no response{r.status === "error" ? " (error)" : ""}</em>}</Field>
                    {r.aiScores.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-[#8a8f98] mb-1">AI judge</div>
                        <div className="flex flex-wrap gap-2">
                          {r.aiScores.map((s, i) => (
                            <span key={i} className="rounded bg-black/[0.04] dark:bg-white/[0.04] px-2 py-1 text-[12px]">
                              {s.model}: <b>{s.label}</b>{s.confidence != null ? ` · ${Math.round(s.confidence * 100)}%` : ""}{s.score != null ? ` · ${Math.round(s.score)}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.humanRatings.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-[#8a8f98] mb-1">Human verdicts</div>
                        {r.humanRatings.map((h, i) => (
                          <div key={i} className="text-[12px]"><LabelPill label={h.label} /> {h.rationale && <span className="text-[#8a8f98]">— {h.rationale}</span>}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </Page>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <Card className="p-3 text-center">
      <div className={`text-[22px] font-semibold ${cls}`}>{value}</div>
      <div className="text-[11px] text-[#8a8f98]">{label}</div>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#8a8f98] mb-0.5">{label}</div>
      <div className="whitespace-pre-wrap text-[#0a0a0a] dark:text-[#f7f8f8] break-words">{children}</div>
    </div>
  );
}
