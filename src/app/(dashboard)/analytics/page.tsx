"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { FlakinessChart } from "@/components/dashboard/FlakinessChart";
import { CoverageHeatmap } from "@/components/dashboard/CoverageHeatmap";
import { FailureClusters } from "@/components/dashboard/FailureClusters";
import { LatencyChart } from "@/components/dashboard/LatencyChart";
import { TrendAnomalyChart } from "@/components/dashboard/TrendAnomalyChart";
import { ConfidenceScore } from "@/components/dashboard/ConfidenceScore";

type AnalyticsTab = "overview" | "flakiness" | "coverage" | "failures" | "latency" | "trends" | "confidence";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [regressions, setRegressions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(d => setData(d)).catch(() => {});
    fetch("/api/regressions").then(r => r.json()).then(d => setRegressions(d.regressions || [])).catch(() => {});
  }, []);

  if (!data) return <div className="flex h-screen items-center justify-center surface-base"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div>;

  const rates = data.recentPassRates || [];
  const labels = data.runLabels || [];
  const lineData = rates.map((r: number, i: number) => ({ name: labels[i] || `Run ${i + 1}`, rate: r }));

  const passCount = data.recentRuns?.reduce((s: number, r: any) => s + (r.passCount || 0), 0) || 0;
  const failCount = data.recentRuns?.reduce((s: number, r: any) => s + (r.failCount || 0), 0) || 0;
  const partialCount = data.recentRuns?.reduce((s: number, r: any) => s + (r.partialCount || 0), 0) || 0;
  const distData = [
    { name: "Pass", value: passCount, fill: "#4E9363" },
    { name: "Partial", value: partialCount, fill: "#fbbf24" },
    { name: "Fail", value: failCount, fill: "#f87171" },
  ];

  const tabs: { id: AnalyticsTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "flakiness", label: "Flakiness" },
    { id: "coverage", label: "Coverage" },
    { id: "failures", label: "Failures" },
    { id: "latency", label: "Latency" },
    { id: "trends", label: "Trends" },
    { id: "confidence", label: "Confidence" },
  ];

  return (
    <div>
      <DashboardHeader title="Analytics" subtitle="Evaluation performance over time" />
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-1 w-fit flex-wrap">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white dark:bg-[#1a1a1a] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm"
                  : "text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card p-4">
                <BarChart3 className="h-4 w-4 text-[#ABC83A] mb-2" />
                <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{data.totalRuns}</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Total runs</p>
              </div>
              <div className="card p-4">
                <TrendingUp className="h-4 w-4 text-[#4E9363] mb-2" />
                <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{data.passRate ?? "\u2014"}%</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Avg pass rate</p>
              </div>
              <div className="card p-4">
                <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>{data.totalCases}</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Total test cases</p>
              </div>
              <div className="card p-4">
                <TrendingDown className="h-4 w-4 text-red-400 mb-2" />
                <p className="text-[24px] font-semibold text-red-500" style={{ letterSpacing: "-0.03em" }}>{regressions.length}</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Regressions</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="card p-5">
                <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-1" style={{ letterSpacing: "-0.02em" }}>Pass Rate Trend</h3>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-4">Last {rates.length} evaluation runs</p>
                {rates.length > 1 ? (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={lineData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ABC83A" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ABC83A" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8a8f98" }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#8a8f98" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ background: "#0f1011", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px", color: "#f7f8f8", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }} formatter={(v: number) => [`${v}%`, "Pass Rate"]} />
                        <Area type="monotone" dataKey="rate" stroke="#ABC83A" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 3, fill: "#ABC83A", stroke: "#09090b", strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-[13px] text-[#8a8f98] dark:text-[#62666d] py-10 text-center">Need at least 2 rated runs for chart data.</p>
                )}
              </div>

              <div className="card p-5">
                <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-1" style={{ letterSpacing: "-0.02em" }}>Rating Distribution</h3>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-4">All ratings across runs</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8a8f98" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#8a8f98" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "#0f1011", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px", color: "#f7f8f8", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {regressions.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-5">
                <h3 className="text-[14px] font-semibold text-red-600 mb-3" style={{ letterSpacing: "-0.02em" }}>Active Regressions</h3>
                <div className="space-y-2">
                  {regressions.map((r: any) => (
                    <div key={r.projectId} className="flex items-center gap-3 rounded-lg card p-3">
                      <TrendingDown size={16} className="text-red-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{r.projectName}</p>
                        <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{r.previousPassRate}% &rarr; {r.latestPassRate}% ({r.delta}%)</p>
                      </div>
                      <span className="text-[18px] font-semibold text-red-500" style={{ letterSpacing: "-0.03em" }}>{r.delta}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "flakiness" && <FlakinessChart />}
        {activeTab === "coverage" && <CoverageHeatmap />}
        {activeTab === "failures" && <FailureClusters />}
        {activeTab === "latency" && <LatencyChart />}
        {activeTab === "trends" && <TrendAnomalyChart />}
        {activeTab === "confidence" && <ConfidenceScore />}
      </div>
    </div>
  );
}
