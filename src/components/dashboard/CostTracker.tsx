"use client";

import { useEffect, useState } from "react";
import { DollarSign, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DailyCost {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  runs: number;
}

interface CostData {
  totals: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    runCount: number;
  };
  daily: DailyCost[];
  byModel: { model: string; totalCost: number; runCount: number }[];
  trend: { percentChange: number; direction: string };
  period: string;
  days: number;
}

interface Props { projectId?: string; }

export function CostTracker({ projectId }: Props) {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  useEffect(() => { load(); }, [projectId, period]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/costs?${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
      <span className="ml-2 text-[13px] text-[#8a8f98]">Loading costs...</span>
    </div>
  );

  if (!data) return (
    <div className="card p-8 text-center">
      <DollarSign className="mx-auto h-6 w-6 text-[#8a8f98]" />
      <p className="mt-2 text-[13px] text-[#8a8f98]">No cost data available yet.</p>
    </div>
  );

  const TrendIcon = data.trend.direction === "up" ? TrendingUp : data.trend.direction === "down" ? TrendingDown : Minus;
  const trendColor = data.trend.direction === "up" ? "text-red-500" : data.trend.direction === "down" ? "text-[#4E9363]" : "text-[#8a8f98]";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <DollarSign className="h-4 w-4 text-[#ABC83A] mb-2" />
          <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>
            ${data.totals.totalCost.toFixed(2)}
          </p>
          <p className="text-[12px] text-[#8a8f98]">Total cost</p>
        </div>
        <div className="card p-4">
          <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>
            {(data.totals.totalTokens / 1000).toFixed(1)}k
          </p>
          <p className="text-[12px] text-[#8a8f98]">Total tokens</p>
        </div>
        <div className="card p-4">
          <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>
            {data.totals.runCount}
          </p>
          <p className="text-[12px] text-[#8a8f98]">Runs</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1 mb-2">
            <TrendIcon size={14} className={trendColor} />
            <span className={`text-[12px] font-medium ${trendColor}`}>
              {data.trend.percentChange > 0 ? "+" : ""}{data.trend.percentChange}%
            </span>
          </div>
          <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>
            {data.period}
          </p>
          <p className="text-[12px] text-[#8a8f98]">Trend</p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-0.5 w-fit">
        {(["7d", "30d", "90d"] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              period === p ? "bg-white dark:bg-[#1a1a1a] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm" : "text-[#8a8f98]"
            }`}>{p}</button>
        ))}
      </div>

      {data.daily.length > 0 && (
        <div className="card p-5">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-4" style={{ letterSpacing: "-0.02em" }}>
            Daily Cost
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily.slice(-14)} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8a8f98" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "#8a8f98" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#0f1011", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px", color: "#f7f8f8" }} formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]} />
                <Bar dataKey="cost" fill="#ABC83A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.byModel.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Cost by Model</h3>
          </div>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {data.byModel.map(m => (
              <div key={m.model} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{m.model}</p>
                  <p className="text-[10px] text-[#8a8f98]">{m.runCount} runs</p>
                </div>
                <span className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">${m.totalCost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
