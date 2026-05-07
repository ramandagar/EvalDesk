"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ArrowUpDown } from "lucide-react";

interface FlakyItem {
  testCaseId: string;
  input: string;
  title: string;
  flipCount: number;
  flipRate: number;
  totalRuns: number;
  lastFlips: Array<{ from: string; to: string; runName: string | null }>;
}

interface Props {
  projectId?: string;
}

function FlipIndicator({ from, to }: { from: string; to: string }) {
  const color = (r: string) =>
    r === "pass" ? "text-[#4E9363]" : r === "fail" ? "text-red-500" : "text-amber-500";
  const bg = (r: string) =>
    r === "pass" ? "bg-[#4E9363]/10" : r === "fail" ? "bg-red-500/10" : "bg-amber-500/10";

  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <span className={`px-1.5 py-0.5 rounded ${bg(from)} ${color(from)} font-medium`}>{from}</span>
      <span className="text-[#8a8f98]">&rarr;</span>
      <span className={`px-1.5 py-0.5 rounded ${bg(to)} ${color(to)} font-medium`}>{to}</span>
    </span>
  );
}

function FlipBar({ flipRate }: { flipRate: number }) {
  const pct = Math.round(flipRate * 100);
  const color = flipRate > 0.7 ? "#dc2626" : flipRate > 0.4 ? "#D97706" : "#ABC83A";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-medium min-w-[36px] text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export function FlakinessChart({ projectId }: Props) {
  const [data, setData] = useState<FlakyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    load();
  }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const params = projectId ? `?projectId=${projectId}` : "";
      const res = await fetch(`/api/analytics/flakiness${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.flaky || []);
      }
    } catch {}
    setLoading(false);
  }

  function toggleSort() {
    setSortDir((d) => (d === "desc" ? "asc" : "desc"));
  }

  const sorted = [...data].sort((a, b) =>
    sortDir === "desc" ? b.flipRate - a.flipRate : a.flipRate - b.flipRate
  );

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
        <span className="ml-2 text-[13px] text-[#8a8f98]">Analyzing flakiness...</span>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-[#8a8f98]" />
        <p className="mt-2 text-[13px] text-[#8a8f98]">No flaky tests detected yet. Need at least 2 runs with ratings.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
              Flaky Test Cases
            </h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
              {sorted.length} test case{sorted.length !== 1 ? "s" : ""} with inconsistent ratings
            </p>
          </div>
          <button onClick={toggleSort} className="flex items-center gap-1 text-[11px] text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition-colors">
            <ArrowUpDown size={12} />
            {sortDir === "desc" ? "Most flaky" : "Least flaky"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
        {sorted.map((item) => (
          <div key={item.testCaseId} className="px-5 py-3">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">
                  {item.title || `Test ${item.testCaseId.slice(0, 8)}`}
                </p>
                <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] truncate mt-0.5">
                  {item.input.slice(0, 80)}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[11px] text-[#8a8f98]">{item.flipCount} flip{item.flipCount !== 1 ? "s" : ""}</span>
                <span className="text-[11px] text-[#8a8f98]">&middot;</span>
                <span className="text-[11px] text-[#8a8f98]">{item.totalRuns} runs</span>
              </div>
            </div>
            <FlipBar flipRate={item.flipRate} />
            {item.lastFlips.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {item.lastFlips.map((flip, i) => (
                  <FlipIndicator key={i} from={flip.from} to={flip.to} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
