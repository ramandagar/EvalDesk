"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";

interface LatencyTestCase {
  testCaseId: string; input: string; title: string; sampleSize: number;
  avg: number; p50: number; p90: number; p99: number; min: number; max: number;
}

interface LatencyData {
  testCases: LatencyTestCase[];
  overall: { avg: number; p50: number; p90: number; p99: number; sampleSize: number };
}

interface Props { projectId?: string; }

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function PercentileBar({ p50, p90, p99, max }: { p50: number; p90: number; p99: number; max: number }) {
  const scale = max > 0 ? 100 / max : 1;
  return (
    <div className="flex items-center gap-1 h-5 w-full">
      <div className="h-full rounded-l bg-[#ABC83A]/30" style={{ width: `${Math.max(2, p50 * scale)}%` }} title={`p50: ${formatMs(p50)}`} />
      <div className="h-full bg-amber-500/30" style={{ width: `${Math.max(1, (p90 - p50) * scale)}%` }} title={`p90: ${formatMs(p90)}`} />
      <div className="h-full rounded-r bg-red-500/30" style={{ width: `${Math.max(1, (p99 - p90) * scale)}%` }} title={`p99: ${formatMs(p99)}`} />
    </div>
  );
}

export function LatencyChart({ projectId }: Props) {
  const [data, setData] = useState<LatencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<"p99" | "avg" | "p50">("p99");

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const params = projectId ? `?projectId=${projectId}` : "";
      const res = await fetch(`/api/analytics/latency${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
      <span className="ml-2 text-[13px] text-[#8a8f98]">Computing latency...</span>
    </div>
  );

  if (!data || data.testCases.length === 0) return (
    <div className="card p-8 text-center">
      <Clock className="mx-auto h-6 w-6 text-[#8a8f98]" />
      <p className="mt-2 text-[13px] text-[#8a8f98]">No latency data yet.</p>
    </div>
  );

  const sorted = [...data.testCases].sort((a, b) => b[sortKey] - a[sortKey]);
  const maxVal = Math.max(...sorted.map((t) => t.p99), 1);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Response Latency</h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
              avg {formatMs(data.overall.avg)} &middot; p50 {formatMs(data.overall.p50)} &middot; p90 {formatMs(data.overall.p90)} &middot; p99 {formatMs(data.overall.p99)}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-0.5">
            {(["p50", "avg", "p99"] as const).map((key) => (
              <button key={key} onClick={() => setSortKey(key)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  sortKey === key ? "bg-white dark:bg-[#1a1a1a] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm" : "text-[#8a8f98]"
                }`}>
                {key.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
        {sorted.slice(0, 20).map((tc) => (
          <div key={tc.testCaseId} className="px-5 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate max-w-[60%]">
                {tc.title || `Test ${tc.testCaseId.slice(0, 8)}`}
              </p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-[#ABC83A]">p50 {formatMs(tc.p50)}</span>
                <span className="text-amber-500">p90 {formatMs(tc.p90)}</span>
                <span className="text-red-500">p99 {formatMs(tc.p99)}</span>
              </div>
            </div>
            <PercentileBar p50={tc.p50} p90={tc.p90} p99={tc.p99} max={maxVal} />
            <p className="text-[10px] text-[#8a8f98] mt-1">{tc.sampleSize} samples</p>
          </div>
        ))}
      </div>
    </div>
  );
}
