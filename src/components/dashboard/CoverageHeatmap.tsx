"use client";

import { useEffect, useState } from "react";
import { Grid3x3, Loader2 } from "lucide-react";

interface CoverageItem {
  name: string;
  totalCases: number;
  evaluatedCases: number;
  coveragePercent: number;
}

interface CoverageSummary {
  totalCases: number;
  evaluatedCases: number;
  coveragePercent: number;
}

interface CoverageData {
  categories: CoverageItem[];
  tags: CoverageItem[];
  summary: CoverageSummary;
}

interface Props {
  projectId?: string;
}

function CoverageCell({ item }: { item: CoverageItem }) {
  const color =
    item.coveragePercent >= 80
      ? { bg: "bg-[#4E9363]/15", text: "text-[#4E9363]", bar: "#4E9363" }
      : item.coveragePercent >= 50
        ? { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "#D97706" }
        : item.coveragePercent > 0
          ? { bg: "bg-red-500/10", text: "text-red-500", bar: "#dc2626" }
          : { bg: "bg-black/[0.03] dark:bg-white/[0.03]", text: "text-[#8a8f98]", bar: "#8a8f98" };

  return (
    <div className={`rounded-lg p-3 ${color.bg} border border-black/[0.04] dark:border-white/[0.04]`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate max-w-[70%]">
          {item.name}
        </span>
        <span className={`text-[13px] font-semibold ${color.text}`}>
          {item.coveragePercent}%
        </span>
      </div>
      <div className="h-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${item.coveragePercent}%`, backgroundColor: color.bar }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8a8f98]">
          {item.evaluatedCases}/{item.totalCases} evaluated
        </span>
      </div>
    </div>
  );
}

export function CoverageHeatmap({ projectId }: Props) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"categories" | "tags">("categories");

  useEffect(() => {
    load();
  }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const params = projectId ? `?projectId=${projectId}` : "";
      const res = await fetch(`/api/analytics/coverage${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
        <span className="ml-2 text-[13px] text-[#8a8f98]">Loading coverage...</span>
      </div>
    );
  }

  if (!data || (data.categories.length === 0 && data.tags.length === 0)) {
    return (
      <div className="card p-8 text-center">
        <Grid3x3 className="mx-auto h-6 w-6 text-[#8a8f98]" />
        <p className="mt-2 text-[13px] text-[#8a8f98]">No test cases with categories or tags yet.</p>
      </div>
    );
  }

  const items = view === "categories" ? data.categories : data.tags;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
              Evaluation Coverage
            </h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
              {data.summary.evaluatedCases}/{data.summary.totalCases} cases evaluated ({data.summary.coveragePercent}%)
            </p>
          </div>
          <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-0.5">
            <button
              onClick={() => setView("categories")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                view === "categories"
                  ? "bg-white dark:bg-[#1a1a1a] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm"
                  : "text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setView("tags")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                view === "tags"
                  ? "bg-white dark:bg-[#1a1a1a] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm"
                  : "text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
              }`}
            >
              Tags
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {items.map((item) => (
          <CoverageCell key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}
