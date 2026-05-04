"use client";

import { FolderKanban, CheckCircle2, XCircle, TrendingUp, Sparkles } from "lucide-react";

export function StatsCards({ projects, totalRuns, passRate, totalCases, recentPassRates }: {
  projects: number; totalRuns: number; passRate: number | null; totalCases: number; recentPassRates: number[];
}) {
  const sparkline = (values: number[]) => {
    if (values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const w = 60;
    const h = 20;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const cards = [
    { label: "Projects", value: projects, icon: FolderKanban, color: "text-[#ABC83A]", bg: "bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15" },
    { label: "Total runs", value: totalRuns, icon: TrendingUp, color: "text-[#6FA3A5]", bg: "bg-[#6FA3A5]/10 dark:bg-[#6FA3A5]/15" },
    { label: "Pass rate", value: passRate !== null ? `${passRate}%` : "\u2014", icon: CheckCircle2, color: "text-[#4E9363]", bg: "bg-[#4E9363]/10 dark:bg-[#4E9363]/15", spark: recentPassRates.length > 1 ? recentPassRates : null },
    { label: "Test cases", value: totalCases, icon: Sparkles, color: "text-[#6D75A6]", bg: "bg-[#6D75A6]/10 dark:bg-[#6D75A6]/15" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
              <c.icon className={`h-[15px] w-[15px] ${c.color}`} />
            </div>
            {c.spark && (
              <svg width="60" height="20" className="opacity-40">
                <path
                  d={sparkline(c.spark) || ""}
                  fill="none"
                  stroke="#ABC83A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>
            {c.value}
          </p>
          <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]" style={{ letterSpacing: "-0.01em" }}>
            {c.label}
          </p>
        </div>
      ))}
    </div>
  );
}
