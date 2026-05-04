"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { CheckCircle2, XCircle, MinusCircle, Bot, Loader2, MessageSquare, Clock, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface TestCase { id: string; title: string; input: string; expectedOutput: string | null; category: string | null; }
interface RunResult { id: string; testCaseId: string; agentResponse: string | null; responseTime: number | null; status: string; errorMessage: string | null; humanRating: string | null; humanComment: string | null; judgeRating: string | null; judgeScore: number | null; judgeReasoning: string | null; testCase: TestCase; }
interface RunData { id: string; name: string | null; status: string; totalCases: number; passCount: number; failCount: number; partialCount: number; unratedCount: number; passRate: number | null; results: RunResult[]; }

export default function RunsPage() {
  const params = useParams();
  const router = useRouter();
  const [runData, setRunData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [judging, setJudging] = useState<string | null>(null);

  useEffect(() => { loadLatest(); }, [params.id]);

  async function loadLatest() {
    try {
      const res = await fetch(`/api/runs?projectId=${params.id}&limit=1`);
      if (res.ok) { const runs = await res.json(); if (runs.length > 0) { const rr = await fetch(`/api/runs/${runs[0].id}`); if (rr.ok) setRunData(await rr.json()); } }
    } catch {}
    setLoading(false);
  }

  const cur = runData?.results[idx];

  async function rate(rating: "pass" | "fail" | "partial") {
    if (!cur) return;
    setRunData(prev => {
      if (!prev) return prev;
      const results = [...prev.results]; results[idx] = { ...results[idx], humanRating: rating };
      const rated = results.filter(r => r.humanRating);
      return { ...prev, results, passCount: rated.filter(r => r.humanRating === "pass").length, failCount: rated.filter(r => r.humanRating === "fail").length, partialCount: rated.filter(r => r.humanRating === "partial").length, unratedCount: results.filter(r => !r.humanRating).length, passRate: rated.length ? Math.round(rated.filter(r => r.humanRating === "pass").length / rated.length * 100) : null };
    });
    try { await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runResultId: cur.id, rating, comment: comment || undefined }) }); } catch {}
    setComment(""); setShowComment(false);
    const next = runData?.results.findIndex((r, i) => i > idx && !r.humanRating);
    if (next !== undefined && next !== -1) setIdx(next); else if (idx < (runData?.results.length || 0) - 1) setIdx(idx + 1);
  }

  async function autoJudge(id: string) {
    setJudging(id);
    try {
      const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runResultId: id }) });
      if (res.ok) { const d = await res.json(); setRunData(prev => prev ? { ...prev, results: prev.results.map(r => r.id === id ? { ...r, judgeRating: d.rating, judgeScore: d.score, judgeReasoning: d.reasoning } : r) } : prev); toast.success(`Judge: ${d.rating} (${d.score}/100)`); }
      else toast.error("Judge failed — check OpenAI API key");
    } catch { toast.error("Judge failed"); }
    setJudging(null);
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showComment && e.key !== "Escape") return;
    if (e.key === "1") rate("pass"); else if (e.key === "2") rate("partial"); else if (e.key === "3") rate("fail");
    else if (e.key === "ArrowRight" && idx < (runData?.results.length || 0) - 1) setIdx(idx + 1);
    else if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    else if (e.key === "c") setShowComment(true); else if (e.key === "Escape") setShowComment(false);
  }, [idx, runData, showComment]);

  useEffect(() => { window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [handleKeyDown]);

  if (loading) return <div className="flex h-screen items-center justify-center surface-base"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div>;
  if (!runData || !runData.results.length) return (<div><DashboardHeader title="Runs" /><div className="flex flex-col items-center justify-center py-20"><MessageSquare className="h-8 w-8 text-[#8a8f98] dark:text-[#62666d]" /><p className="mt-3 text-[13px] text-[#8a8f98] dark:text-[#62666d]">No runs yet.</p><button onClick={() => router.push(`/projects/${params.id}`)} className="mt-3 text-[12px] font-medium text-[#ABC83A] hover:underline">Back to project</button></div></div>);

  const rated = runData.passCount + runData.failCount + runData.partialCount;

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader title={runData.name || "Run results"} subtitle={`${rated}/${runData.totalCases} rated · ${runData.passRate !== null ? `${runData.passRate}% pass` : "No ratings"}`} />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-black/[0.06] dark:border-white/[0.06] overflow-y-auto shrink-0 bg-white dark:bg-[#0f1011]">
          <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.06] space-y-2">
            <div className="flex justify-between text-[11px] text-[#8a8f98] dark:text-[#62666d]"><span>Progress</span><span>{rated}/{runData.totalCases}</span></div>
            <div className="flex h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
              {runData.passCount > 0 && <div className="bg-[#4E9363]" style={{ width: `${(runData.passCount / runData.totalCases) * 100}%` }} />}
              {runData.partialCount > 0 && <div className="bg-amber-400" style={{ width: `${(runData.partialCount / runData.totalCases) * 100}%` }} />}
              {runData.failCount > 0 && <div className="bg-red-400" style={{ width: `${(runData.failCount / runData.totalCases) * 100}%` }} />}
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="text-[#4E9363]">{runData.passCount} pass</span>
              <span className="text-amber-500">{runData.partialCount} partial</span>
              <span className="text-red-400">{runData.failCount} fail</span>
            </div>
          </div>
          <div className="p-1.5 space-y-0.5">
            {runData.results.map((r, i) => (
              <button key={r.id} onClick={() => setIdx(i)} className={`w-full text-left rounded-lg px-2.5 py-[7px] text-[12px] transition-all duration-150 flex items-center gap-1.5 ${i === idx ? "bg-[#ABC83A]/10 text-[#0a0a0a] dark:text-[#f7f8f8] font-medium" : "text-[#8a8f98] dark:text-[#62666d] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}>
                {r.humanRating === "pass" ? <CheckCircle2 size={12} className="text-[#4E9363] shrink-0" /> : r.humanRating === "fail" ? <XCircle size={12} className="text-red-400 shrink-0" /> : r.humanRating === "partial" ? <MinusCircle size={12} className="text-amber-400 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-[#8a8f98]/30 dark:border-[#62666d]/30 shrink-0" />}
                <span className="truncate">{r.testCase.input}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        {cur && (
          <div className="flex-1 overflow-y-auto p-5 surface-base">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Case {idx + 1} of {runData.totalCases}</span>
                {cur.testCase.category && <span className="inline-flex items-center gap-1 rounded-full bg-[#ABC83A]/8 border border-[#ABC83A]/15 px-2.5 py-0.5 text-[10px] font-medium text-[#ABC83A]">{cur.testCase.category}</span>}
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1.5">Question</p>
                <p className="text-[14px] leading-relaxed text-[#0a0a0a] dark:text-[#f7f8f8]">{cur.testCase.input}</p>
              </div>
              {cur.testCase.expectedOutput && (
                <div className="card p-3">
                  <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Expected</p>
                  <p className="text-[13px] text-[#8a8f98] dark:text-[#62666d] leading-relaxed">{cur.testCase.expectedOutput}</p>
                </div>
              )}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider">Agent response</p>
                  {cur.responseTime && <span className="flex items-center gap-1 text-[11px] text-[#8a8f98] dark:text-[#62666d]"><Clock size={10} />{cur.responseTime}ms</span>}
                </div>
                {cur.status === "error" ? <p className="text-[13px] text-red-400">Error: {cur.errorMessage}</p> : cur.status === "timeout" ? <p className="text-[13px] text-amber-500">Timed out</p> : <p className="text-[13px] leading-relaxed text-[#0a0a0a] dark:text-[#d0d6e0] whitespace-pre-wrap">{cur.agentResponse || "No response"}</p>}
              </div>
              {cur.judgeRating && (
                <div className="rounded-xl border border-[#6D75A6]/15 bg-[#6D75A6]/5 dark:bg-[#6D75A6]/10 p-3">
                  <div className="flex items-center gap-2 mb-1"><Bot size={14} className="text-[#6D75A6]" /><span className="text-[12px] font-medium text-[#6D75A6]">LLM Judge</span><span className="ml-auto text-[11px] text-[#8a8f98] dark:text-[#62666d]">{cur.judgeScore}/100</span></div>
                  <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">{cur.judgeReasoning}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => rate("pass")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-3 text-[13px] font-semibold border transition-all duration-150 ${cur.humanRating === "pass" ? "bg-[#4E9363] text-white border-[#4E9363]" : "bg-[#4E9363]/5 border-[#4E9363]/20 text-[#4E9363] hover:bg-[#4E9363]/10"}`}><CheckCircle2 size={15} /> Pass <kbd className="text-[10px] opacity-40 ml-0.5">1</kbd></button>
                <button onClick={() => rate("partial")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-3 text-[13px] font-semibold border transition-all duration-150 ${cur.humanRating === "partial" ? "bg-amber-400 text-white border-amber-400" : "bg-amber-400/5 border-amber-400/20 text-amber-500 hover:bg-amber-400/10"}`}><MinusCircle size={15} /> Partial <kbd className="text-[10px] opacity-40 ml-0.5">2</kbd></button>
                <button onClick={() => rate("fail")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-3 text-[13px] font-semibold border transition-all duration-150 ${cur.humanRating === "fail" ? "bg-red-400 text-white border-red-400" : "bg-red-400/5 border-red-400/20 text-red-400 hover:bg-red-400/10"}`}><XCircle size={15} /> Fail <kbd className="text-[10px] opacity-40 ml-0.5">3</kbd></button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => autoJudge(cur.id)} disabled={!!judging} className="btn-secondary">{judging === cur.id ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />} Auto-judge</button>
                <button onClick={() => setShowComment(!showComment)} className="btn-secondary"><MessageSquare size={12} /> Comment <kbd className="text-[10px] text-[#8a8f98] dark:text-[#62666d]">C</kbd></button>
                <div className="ml-auto flex gap-2">
                  <a href={`/api/export?runId=${runData.id}&format=csv`} download className="btn-secondary"><Download size={12} /> CSV</a>
                  <a href={`/api/export?runId=${runData.id}&format=html`} download className="btn-secondary"><FileText size={12} /> PDF</a>
                </div>
              </div>
              {showComment && (
                <div className="flex gap-2"><input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." className="input flex-1" autoFocus /><button onClick={() => { setShowComment(false); setComment(""); }} className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Esc</button></div>
              )}
              <div className="flex items-center justify-center gap-4 text-[11px] text-[#8a8f98] dark:text-[#62666d] pt-1">
                <span><kbd className="text-[#8a8f98] dark:text-[#62666d]">←</kbd> Prev</span><span><kbd className="text-[#8a8f98] dark:text-[#62666d]">→</kbd> Next</span><span><kbd className="text-[#8a8f98] dark:text-[#62666d]">1</kbd> Pass</span><span><kbd className="text-[#8a8f98] dark:text-[#62666d]">2</kbd> Partial</span><span><kbd className="text-[#8a8f98] dark:text-[#62666d]">3</kbd> Fail</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
