"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import Link from "next/link";
import { Play, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface Run {
  id: string; name: string | null; status: string; passRate: number | null;
  totalCases: number; createdAt: string; projectId: string; projectName?: string;
  passCount: number; failCount: number; partialCount: number;
}

export default function AllRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/runs?limit=50").then(r => r.json()).then(d => setRuns(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center surface-base"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div>;

  const filtered = filter === "all" ? runs : runs.filter(r => {
    if (filter === "rated") return r.passRate !== null;
    if (filter === "unrated") return r.passRate === null;
    return true;
  });

  const totalPass = runs.reduce((s, r) => s + r.passCount, 0);
  const totalFail = runs.reduce((s, r) => s + r.failCount, 0);
  const avgRate = runs.filter(r => r.passRate !== null).length > 0
    ? Math.round(runs.filter(r => r.passRate !== null).reduce((s, r) => s + (r.passRate || 0), 0) / runs.filter(r => r.passRate !== null).length)
    : null;

  return (
    <div>
      <DashboardHeader title="All Runs" subtitle={`${runs.length} runs across all projects`} />
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="card p-4">
            <Play className="h-4 w-4 text-[#ABC83A] mb-2" />
            <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{runs.length}</p>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Total runs</p>
          </div>
          <div className="card p-4">
            <CheckCircle2 className="h-4 w-4 text-[#4E9363] mb-2" />
            <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{totalPass}</p>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Total pass</p>
          </div>
          <div className="card p-4">
            <AlertCircle className="h-4 w-4 text-red-400 mb-2" />
            <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{totalFail}</p>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Total fail</p>
          </div>
          <div className="card p-4">
            <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{avgRate !== null ? `${avgRate}%` : "\u2014"}</p>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Avg pass rate</p>
          </div>
        </div>

        <div className="flex gap-2">
          {["all", "rated", "unrated"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${filter === f ? "bg-[#ABC83A]/10 text-[#ABC83A] border border-[#ABC83A]/20" : "text-[#8a8f98] dark:text-[#62666d] border border-black/[0.06] dark:border-white/[0.06]"}`}>
              {f === "all" ? "All" : f === "rated" ? "Rated" : "Unrated"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Play className="mx-auto h-8 w-8 text-[#8a8f98] dark:text-[#62666d]" />
            <p className="mt-3 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">No runs found</p>
            <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Run an evaluation from any project to see results here.</p>
            <Link href="/projects" className="mt-4 inline-block text-[12px] font-medium text-[#ABC83A] hover:underline">Go to projects</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(run => (
              <Link
                key={run.id}
                href={`/projects/${run.projectId}/runs`}
                className="flex items-center gap-3 card p-3 card-hover"
              >
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${run.status === "completed" ? "bg-[#4E9363]" : "bg-[#6FA3A5] animate-pulse"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate" style={{ letterSpacing: "-0.01em" }}>{run.name || `Run ${run.id.slice(0, 8)}`}</p>
                  <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{run.projectName || "Project"} &middot; {run.totalCases} cases</p>
                </div>
                {run.passRate !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-black/[0.04] dark:bg-white/[0.04]">
                      <div className="bg-[#4E9363]" style={{width:`${run.passRate}%`}} />
                      {run.partialCount > 0 && <div className="bg-amber-400" style={{width:`${(run.partialCount/run.totalCases)*100}%`}} />}
                      <div className="bg-red-400" style={{width:`${(run.failCount/run.totalCases)*100}%`}} />
                    </div>
                    <span className={`text-[13px] font-semibold ${run.passRate >= 80 ? "text-[#4E9363]" : run.passRate >= 50 ? "text-amber-500" : "text-red-400"}`}>{run.passRate}%</span>
                  </div>
                )}
                <span className="flex items-center gap-1 text-[11px] text-[#8a8f98] dark:text-[#62666d]"><Clock size={10} />{formatRelativeTime(new Date(run.createdAt))}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
