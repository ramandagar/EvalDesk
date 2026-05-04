"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface RunOption { id: string; name: string | null; createdAt: string; passRate: number | null; totalCases: number; status: string; }
interface Comparison { testCaseId: string; input: string; expectedOutput: string | null; category: string | null; a: any; b: any; change: string; }
interface CompareData {
  runA: any; runB: any; projectId: string; comparisons: Comparison[];
  summary: { total: number; improved: number; regressed: number; same: number; unrated: number; newCases: number; removed: number; passRateA: number | null; passRateB: number | null; passRateDelta: number; };
}

const changeStyle: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  improved: { bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", icon: TrendingUp, label: "Improved" },
  regressed: { bg: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800", text: "text-red-700 dark:text-red-400", icon: TrendingDown, label: "Regressed" },
  same: { bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700", text: "text-gray-500 dark:text-gray-400", icon: Minus, label: "Same" },
  unrated: { bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800", text: "text-amber-600 dark:text-amber-400", icon: Clock, label: "Unrated" },
  new: { bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800", text: "text-blue-600 dark:text-blue-400", icon: ArrowLeftRight, label: "New case" },
  removed: { bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700", text: "text-gray-400 dark:text-gray-500", icon: Minus, label: "Removed" },
};

const ratingBadge: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  fail: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function ComparePage() {
  const params = useParams();
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [runAId, setRunAId] = useState("");
  const [runBId, setRunBId] = useState("");
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { loadRuns(); }, [params.id]);

  async function loadRuns() {
    try {
      const res = await fetch(`/api/runs?projectId=${params.id}&limit=20`);
      if (res.ok) {
        const d: RunOption[] = await res.json();
        setRuns(d);
        if (d.length >= 2) { setRunAId(d[1].id); setRunBId(d[0].id); }
        else if (d.length === 1) { setRunAId(d[0].id); }
      }
    } catch {}
  }

  async function compare() {
    if (!runAId || !runBId) { toast.error("Select two runs to compare"); return; }
    if (runAId === runBId) { toast.error("Select two different runs"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/compare?runA=${runAId}&runB=${runBId}`);
      if (res.ok) { setData(await res.json()); }
      else { const e = await res.json(); toast.error(e.error || "Failed to compare"); }
    } catch { toast.error("Failed to compare"); }
    setLoading(false);
  }

  const filtered = data?.comparisons.filter(c => filter === "all" || c.change === filter) || [];
  const s = data?.summary;

  return (
    <div className="surface-base">
      <DashboardHeader title="Compare Runs" subtitle="Side-by-side comparison of two evaluation runs" />
      <div className="p-5 space-y-5">
        {/* Run selectors */}
        <div className="card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Run A (older)</label>
              <select value={runAId} onChange={e => setRunAId(e.target.value)} className="input">
                <option value="">Select run...</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.name || `Run ${r.id.slice(0,8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}</option>)}
              </select>
            </div>
            <div className="flex items-center pb-2"><ArrowLeftRight className="h-5 w-5 text-[#ABC83A]" /></div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Run B (newer)</label>
              <select value={runBId} onChange={e => setRunBId(e.target.value)} className="input">
                <option value="">Select run...</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.name || `Run ${r.id.slice(0,8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}</option>)}
              </select>
            </div>
            <button onClick={compare} disabled={loading || !runAId || !runBId} className="btn-primary">
              {loading ? "Comparing..." : "Compare"}
            </button>
          </div>
        </div>

        {/* Results */}
        {data && s && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <div className="card p-3 text-center">
                <p className="text-[20px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{s.total}</p>
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Total cases</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[20px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{s.passRateA ?? "—"}% → {s.passRateB ?? "—"}%</p>
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Pass rate</p>
              </div>
              <button onClick={() => setFilter(filter === "regressed" ? "all" : "regressed")} className={`rounded-xl border p-3 text-center transition-all duration-150 ${filter === "regressed" ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "card hover:border-red-200"}`}>
                <p className="text-[20px] font-semibold text-red-600" style={{ letterSpacing: "-0.03em" }}>{s.regressed}</p>
                <p className="text-[11px] text-red-500">Regressed</p>
              </button>
              <button onClick={() => setFilter(filter === "improved" ? "all" : "improved")} className={`rounded-xl border p-3 text-center transition-all duration-150 ${filter === "improved" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "card hover:border-emerald-200"}`}>
                <p className="text-[20px] font-semibold text-emerald-600" style={{ letterSpacing: "-0.03em" }}>{s.improved}</p>
                <p className="text-[11px] text-emerald-500">Improved</p>
              </button>
              <button onClick={() => setFilter(filter === "same" ? "all" : "same")} className={`rounded-xl border p-3 text-center transition-all duration-150 ${filter === "same" ? "border-gray-300 bg-gray-50 dark:bg-gray-900/30" : "card hover:border-gray-200"}`}>
                <p className="text-[20px] font-semibold text-gray-500" style={{ letterSpacing: "-0.03em" }}>{s.same}</p>
                <p className="text-[11px] text-gray-400">Unchanged</p>
              </button>
              <button onClick={() => setFilter(filter === "unrated" ? "all" : "unrated")} className={`rounded-xl border p-3 text-center transition-all duration-150 ${filter === "unrated" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "card hover:border-amber-200"}`}>
                <p className="text-[20px] font-semibold text-amber-500" style={{ letterSpacing: "-0.03em" }}>{s.unrated}</p>
                <p className="text-[11px] text-amber-400">Unrated</p>
              </button>
              <div className="card p-3 text-center">
                <p className={`text-[20px] font-semibold ${s.passRateDelta > 0 ? "text-emerald-600" : s.passRateDelta < 0 ? "text-red-600" : "text-gray-400"}`} style={{ letterSpacing: "-0.03em" }}>
                  {s.passRateDelta > 0 ? "+" : ""}{s.passRateDelta}%
                </p>
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Delta</p>
              </div>
            </div>

            {/* Delta bar */}
            <div className="card p-3">
              <div className="flex h-3 rounded-full overflow-hidden bg-black/[0.04] dark:bg-white/[0.04]">
                {s.improved > 0 && <div className="bg-emerald-400" style={{ width: `${(s.improved / s.total) * 100}%` }} title={`${s.improved} improved`} />}
                {s.same > 0 && <div className="bg-gray-300 dark:bg-gray-600" style={{ width: `${(s.same / s.total) * 100}%` }} title={`${s.same} unchanged`} />}
                {s.regressed > 0 && <div className="bg-red-400" style={{ width: `${(s.regressed / s.total) * 100}%` }} title={`${s.regressed} regressed`} />}
                {s.unrated > 0 && <div className="bg-amber-300" style={{ width: `${(s.unrated / s.total) * 100}%` }} title={`${s.unrated} unrated`} />}
              </div>
            </div>

            {/* Comparison rows */}
            <div className="space-y-2">
              {filtered.length === 0 && <p className="text-[13px] text-[#8a8f98] dark:text-[#62666d] text-center py-8">No cases match this filter.</p>}
              {filtered.map((c) => {
                const cs = changeStyle[c.change] || changeStyle.unrated;
                const Icon = cs.icon;
                return (
                  <details key={c.testCaseId} className={`rounded-xl border ${cs.bg} overflow-hidden`}>
                    <summary className="flex items-center gap-3 p-3 cursor-pointer">
                      <span className={`flex items-center gap-1 text-[11px] font-medium ${cs.text}`}><Icon size={12} /> {cs.label}</span>
                      <p className="flex-1 text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] truncate">{c.input}</p>
                      {c.category && <span className="text-[10px] text-[#8a8f98] dark:text-[#62666d] bg-black/[0.04] dark:bg-white/[0.04] px-2 py-0.5 rounded">{c.category}</span>}
                      {c.a.rating && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ratingBadge[c.a.rating] || "bg-black/[0.04]"}`}>{c.a.rating}</span>}
                      <span className="text-[10px] text-[#8a8f98] dark:text-[#62666d]">→</span>
                      {c.b?.rating && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ratingBadge[c.b.rating] || "bg-black/[0.04]"}`}>{c.b.rating}</span>}
                    </summary>
                    <div className="grid grid-cols-2 gap-px bg-black/[0.06] dark:bg-white/[0.06] border-t border-black/[0.06] dark:border-white/[0.06]">
                      <div className="bg-white dark:bg-[#0f1011] p-3">
                        <p className="text-[10px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Run A</p>
                        <p className="text-[12px] text-[#8a8f98] dark:text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">{c.a.response || <span className="text-red-400">{c.a.status === "error" ? `Error: ${c.a.errorMessage}` : "No response"}</span>}</p>
                        {c.a.responseTime && <p className="mt-1 text-[10px] text-[#8a8f98] dark:text-[#62666d]">{c.a.responseTime}ms</p>}
                      </div>
                      <div className="bg-white dark:bg-[#0f1011] p-3">
                        <p className="text-[10px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Run B</p>
                        {c.b ? (
                          <>
                            <p className="text-[12px] text-[#8a8f98] dark:text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">{c.b.response || <span className="text-red-400">{c.b.status === "error" ? `Error: ${c.b.errorMessage}` : "No response"}</span>}</p>
                            {c.b.responseTime && <p className="mt-1 text-[10px] text-[#8a8f98] dark:text-[#62666d]">{c.b.responseTime}ms</p>}
                          </>
                        ) : <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Not in this run</p>}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}

        {/* Empty state */}
        {!data && !loading && (
          <div className="card p-10 text-center">
            <ArrowLeftRight className="mx-auto h-8 w-8 text-[#8a8f98] dark:text-[#62666d]" />
            <p className="mt-3 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">Compare two runs</p>
            <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Select two runs above to see what changed between them.</p>
            {runs.length < 2 && <p className="mt-2 text-[12px] text-amber-500">You need at least 2 completed runs to compare.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
