"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { GitCompare, Loader2, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { toast } from "sonner";

interface RunOption { id: string; name: string | null; createdAt: string; passRate: number | null; totalCases: number; status: string; projectName?: string; projectId: string; }

const changeStyle: Record<string, { text: string; icon: any; label: string }> = {
  improved: { text: "text-emerald-700 dark:text-emerald-400", icon: TrendingUp, label: "Improved" },
  regressed: { text: "text-red-700 dark:text-red-400", icon: TrendingDown, label: "Regressed" },
  same: { text: "text-gray-500 dark:text-gray-400", icon: Minus, label: "Same" },
  unrated: { text: "text-amber-600 dark:text-amber-400", icon: Clock, label: "Unrated" },
};

export default function GlobalComparePage() {
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [runAId, setRunAId] = useState("");
  const [runBId, setRunBId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/runs?limit=30").then(r => r.json()).then(d => {
      setRuns(d);
      if (d.length >= 2) { setRunAId(d[1].id); setRunBId(d[0].id); }
      else if (d.length === 1) { setRunAId(d[0].id); }
    }).catch(() => {});
  }, []);

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

  const s = data?.summary;

  return (
    <div>
      <DashboardHeader title="Compare Runs" subtitle="Side-by-side comparison of any two runs" />
      <div className="p-5 space-y-5">
        <div className="card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Run A (older)</label>
              <select value={runAId} onChange={e => setRunAId(e.target.value)} className="input">
                <option value="">Select run...</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.projectName}: {r.name || `Run ${r.id.slice(0,8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}</option>)}
              </select>
            </div>
            <div className="flex items-center pb-2"><GitCompare className="h-5 w-5 text-[#ABC83A]" /></div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Run B (newer)</label>
              <select value={runBId} onChange={e => setRunBId(e.target.value)} className="input">
                <option value="">Select run...</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.projectName}: {r.name || `Run ${r.id.slice(0,8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}</option>)}
              </select>
            </div>
            <button onClick={compare} disabled={loading || !runAId || !runBId} className="btn-primary">
              {loading ? "Comparing..." : "Compare"}
            </button>
          </div>
        </div>

        {data && s && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <div className="card p-3 text-center">
                <p className="text-[20px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{s.total}</p>
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Total cases</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[20px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{s.passRateA ?? "\u2014"}% &rarr; {s.passRateB ?? "\u2014"}%</p>
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Pass rate</p>
              </div>
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-3 text-center">
                <p className="text-[20px] font-semibold text-red-600" style={{ letterSpacing: "-0.03em" }}>{s.regressed}</p>
                <p className="text-[11px] text-red-500">Regressed</p>
              </div>
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-center">
                <p className="text-[20px] font-semibold text-emerald-600" style={{ letterSpacing: "-0.03em" }}>{s.improved}</p>
                <p className="text-[11px] text-emerald-500">Improved</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[20px] font-semibold text-gray-500" style={{ letterSpacing: "-0.03em" }}>{s.same}</p>
                <p className="text-[11px] text-gray-400">Unchanged</p>
              </div>
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-center">
                <p className="text-[20px] font-semibold text-amber-500" style={{ letterSpacing: "-0.03em" }}>{s.unrated}</p>
                <p className="text-[11px] text-amber-400">Unrated</p>
              </div>
              <div className="card p-3 text-center">
                <p className={`text-[20px] font-semibold ${s.passRateDelta > 0 ? "text-emerald-600" : s.passRateDelta < 0 ? "text-red-600" : "text-gray-400"}`} style={{ letterSpacing: "-0.03em" }}>
                  {s.passRateDelta > 0 ? "+" : ""}{s.passRateDelta}%
                </p>
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Delta</p>
              </div>
            </div>

            <div className="space-y-2">
              {data.comparisons.map((c: any) => {
                const cs = changeStyle[c.change] || changeStyle.unrated;
                const Icon = cs.icon;
                return (
                  <details key={c.testCaseId} className="card overflow-hidden">
                    <summary className="flex items-center gap-3 p-3 cursor-pointer">
                      <span className={`flex items-center gap-1 text-[11px] font-medium ${cs.text}`}><Icon size={12} /> {cs.label}</span>
                      <p className="flex-1 text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] truncate">{c.input}</p>
                      {c.category && <span className="text-[10px] text-[#8a8f98] dark:text-[#62666d] bg-black/[0.04] dark:bg-white/[0.04] px-2 py-0.5 rounded">{c.category}</span>}
                    </summary>
                    <div className="grid grid-cols-2 gap-px bg-black/[0.06] dark:bg-white/[0.06] border-t border-black/[0.06] dark:border-white/[0.06]">
                      <div className="bg-white dark:bg-[#0f1011] p-3">
                        <p className="text-[10px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Run A</p>
                        <p className="text-[12px] text-[#8a8f98] dark:text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">{c.a.response || "No response"}</p>
                      </div>
                      <div className="bg-white dark:bg-[#0f1011] p-3">
                        <p className="text-[10px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Run B</p>
                        <p className="text-[12px] text-[#8a8f98] dark:text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">{c.b?.response || "Not in this run"}</p>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}

        {!data && !loading && (
          <div className="card p-10 text-center">
            <GitCompare className="mx-auto h-8 w-8 text-[#8a8f98] dark:text-[#62666d]" />
            <p className="mt-3 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">Compare any two runs</p>
            <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Select two runs from different projects or the same project.</p>
            {runs.length < 2 && <p className="mt-2 text-[12px] text-amber-500">You need at least 2 completed runs to compare.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
