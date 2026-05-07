"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle } from "lucide-react";

interface TrendRun {
  id: string; name: string | null; passRate: number | null;
  movingAvg: number; isAnomaly: boolean; drop: number; createdAt: string | null;
}

interface Anomaly {
  runId: string; runName: string; passRate: number | null;
  movingAvg: number; drop: number;
}

interface TrendData {
  anomalies: Anomaly[]; trend: "improving" | "stable" | "degrading";
  trendDelta: number; runs: TrendRun[];
}

interface Props { projectId?: string; }

function TrendBadge({ trend, delta }: { trend: string; delta: number }) {
  if (trend === "improving") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#4E9363]/10 text-[11px] font-medium text-[#4E9363]">
      <TrendingUp size={12} /> +{delta}%
    </span>
  );
  if (trend === "degrading") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-[11px] font-medium text-red-500">
      <TrendingDown size={12} /> {delta}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] text-[11px] font-medium text-[#8a8f98]">
      <Minus size={12} /> stable
    </span>
  );
}

export function TrendAnomalyChart({ projectId }: Props) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const params = projectId ? `?projectId=${projectId}` : "";
      const res = await fetch(`/api/analytics/trends${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
      <span className="ml-2 text-[13px] text-[#8a8f98]">Detecting trends...</span>
    </div>
  );

  if (!data || data.runs.length === 0) return (
    <div className="card p-8 text-center">
      <TrendingUp className="mx-auto h-6 w-6 text-[#8a8f98]" />
      <p className="mt-2 text-[13px] text-[#8a8f98]">Need at least 2 completed runs for trend analysis.</p>
    </div>
  );

  const runWidth = Math.max(8, Math.min(40, 600 / data.runs.length));

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Pass Rate Trends</h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
              {data.runs.length} runs &middot; {data.anomalies.length} anomal{data.anomalies.length !== 1 ? "ies" : "y"}
            </p>
          </div>
          <TrendBadge trend={data.trend} delta={data.trendDelta} />
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-end gap-1 h-32">
          {data.runs.map((run, i) => {
            const rate = run.passRate || 0;
            const height = rate;
            const color = run.isAnomaly ? "bg-red-500" : rate >= 80 ? "bg-[#4E9363]" : rate >= 50 ? "bg-amber-500" : "bg-red-400";
            return (
              <div key={run.id} className={`relative group ${color} rounded-t transition-all opacity-80 hover:opacity-100`}
                style={{ width: `${runWidth}px`, minWidth: 6, height: `${Math.max(2, height)}%` }}
                title={`${run.name || `Run ${i + 1}`}: ${rate}%${run.isAnomaly ? " (anomaly)" : ""}`}>
                {run.isAnomaly && <AlertTriangle size={10} className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-red-500" />}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-[#8a8f98]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#4E9363]" /> Pass</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" /> Warning</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Anomaly</span>
        </div>
      </div>

      {data.anomalies.length > 0 && (
        <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="px-5 py-3 bg-red-50/50 dark:bg-red-950/20">
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400">Anomalies Detected</p>
          </div>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {data.anomalies.map((a) => (
              <div key={a.runId} className="px-5 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{a.runName}</p>
                  <p className="text-[10px] text-[#8a8f98]">Expected ~{a.movingAvg}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-red-500">{a.passRate}%</p>
                  <p className="text-[10px] text-red-400">-{a.drop}% drop</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
