"use client";

import { useState } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";

interface ModelStat {
  model: string;
  totalRuns: number;
  avgPassRate: number;
  totalPassCount: number;
  totalFailCount: number;
  totalCases: number;
  avgResponseTime: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

type SortKey = "model" | "totalRuns" | "avgPassRate" | "avgResponseTime" | "totalCost";
type SortDir = "asc" | "desc";

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

function passRateColor(rate: number): string {
  if (rate >= 80) return "text-[#4E9363]";
  if (rate >= 50) return "text-amber-500";
  return "text-red-500";
}

function passRateBg(rate: number): string {
  if (rate >= 80) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (rate >= 50) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-red-500/10 text-red-500 border-red-500/20";
}

export function ModelComparisonTable({ models }: { models: ModelStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...models].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "model") return mul * a.model.localeCompare(b.model);
    return mul * ((a[sortKey] as number) - (b[sortKey] as number));
  });

  // Totals row
  const totals = models.reduce(
    (acc, m) => ({
      totalRuns: acc.totalRuns + m.totalRuns,
      totalCost: acc.totalCost + m.totalCost,
      totalInputTokens: acc.totalInputTokens + m.totalInputTokens,
      totalOutputTokens: acc.totalOutputTokens + m.totalOutputTokens,
      totalCases: acc.totalCases + m.totalCases,
    }),
    { totalRuns: 0, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCases: 0 }
  );

  if (models.length === 0) {
    return (
      <div className="card p-10 text-center">
        <TrendingUp className="mx-auto h-8 w-8 text-[#8a8f98] dark:text-[#62666d]" />
        <p className="mt-3 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">No model data yet</p>
        <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Run evaluations with different models to compare performance.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
          Model Comparison
        </h3>
        <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
          {models.length} model{models.length !== 1 ? "s" : ""} across {totals.totalRuns} run{totals.totalRuns !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
              <SortableHeader label="Model" sortKey="model" currentKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
              <SortableHeader label="Runs" sortKey="totalRuns" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Pass Rate" sortKey="avgPassRate" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Avg Response" sortKey="avgResponseTime" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Tokens" sortKey="totalCost" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Cost" sortKey="totalCost" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.model} className="border-b border-black/[0.06] dark:border-white/[0.06] last:border-0 hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <span className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{m.model || "Unknown"}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8]">{m.totalRuns}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium ${passRateBg(m.avgPassRate)}`}>
                    {m.avgPassRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-[13px] text-[#8a8f98] dark:text-[#62666d]">
                    {m.avgResponseTime ? `${m.avgResponseTime}ms` : "\u2014"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-[13px] text-[#8a8f98] dark:text-[#62666d]">
                    {formatTokens(m.totalInputTokens + m.totalOutputTokens)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{formatCost(m.totalCost)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
              <td className="px-4 py-2.5">
                <span className="text-[12px] font-semibold text-[#8a8f98] dark:text-[#62666d]">Total</span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className="text-[12px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">{totals.totalRuns}</span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className="text-[12px] font-semibold text-[#8a8f98] dark:text-[#62666d]">\u2014</span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className="text-[12px] font-semibold text-[#8a8f98] dark:text-[#62666d]">\u2014</span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className="text-[12px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">{formatTokens(totals.totalInputTokens + totals.totalOutputTokens)}</span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className="text-[12px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">{formatCost(totals.totalCost)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  align = "center",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "center";
}) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider cursor-pointer hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition-colors ${
        align === "left" ? "text-left" : "text-center"
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={10}
          className={isActive ? "text-[#ABC83A]" : "opacity-40"}
        />
      </span>
    </th>
  );
}
