"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentRuns } from "@/components/dashboard/RecentRuns";
import { PassRateChart } from "@/components/dashboard/PassRateChart";
import { AlertTriangle, TrendingDown, ArrowRight, Plus, FolderKanban, Play, BookOpen } from "lucide-react";
import Link from "next/link";

interface Regression {
  projectId: string;
  projectName: string;
  latestRunId: string;
  latestRunName: string;
  latestRunDate: string;
  latestPassRate: number;
  previousPassRate: number;
  delta: number;
  totalCases: number;
  passCount: number;
  failCount: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [regressions, setRegressions] = useState<Regression[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(d => setData(d)).catch(() => setData(null)).finally(() => setLoading(false));
    fetch("/api/regressions").then(r => r.json()).then(d => setRegressions(d.regressions || [])).catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center surface-base">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" />
    </div>
  );

  const d = data || { projects: 0, totalRuns: 0, passRate: null, totalCases: 0, recentRuns: [], recentPassRates: [], runLabels: [] };

  return (
    <div>
      <DashboardHeader title="Dashboard" subtitle="Overview of all your AI agent evaluations" />
      <div className="p-5 space-y-5">
        <StatsCards projects={d.projects} totalRuns={d.totalRuns} passRate={d.passRate} totalCases={d.totalCases} recentPassRates={d.recentPassRates || []} />

        {d.recentPassRates?.length > 1 && (
          <PassRateChart passRates={d.recentPassRates} labels={d.runLabels} />
        )}

        {/* Regression Alerts */}
        {regressions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-500" />
              <h2 className="text-[14px] font-semibold text-red-600" style={{ letterSpacing: "-0.02em" }}>Regression Alerts</h2>
              <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-500">{regressions.length}</span>
            </div>
            {regressions.map((r) => (
              <Link
                key={r.projectId}
                href={`/projects/${r.projectId}/compare`}
                className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-3 hover:border-red-300 transition group card-hover"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <TrendingDown size={14} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{r.projectName}</p>
                  <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">
                    Pass rate dropped from <span className="font-medium text-[#0a0a0a] dark:text-[#d0d6e0]">{r.previousPassRate}%</span> to{" "}
                    <span className="font-medium text-red-500">{r.latestPassRate}%</span>{" "}
                    in &ldquo;{r.latestRunName}&rdquo;
                  </p>
                </div>
                <span className="text-[20px] font-semibold text-red-500" style={{ letterSpacing: "-0.03em" }}>{r.delta}%</span>
                <ArrowRight size={14} className="text-[#8a8f98] dark:text-[#62666d] group-hover:text-red-400 transition" />
              </Link>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="grid gap-3 lg:grid-cols-3">
          <button onClick={() => router.push("/projects")} className="card p-4 text-left card-hover group">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15">
                <Plus size={16} className="text-[#ABC83A]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Create new project</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Set up a new agent evaluation</p>
              </div>
            </div>
          </button>
          <button onClick={() => router.push("/projects")} className="card p-4 text-left card-hover group">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6FA3A5]/10 dark:bg-[#6FA3A5]/15">
                <FolderKanban size={16} className="text-[#6FA3A5]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>View all projects</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Manage your evaluation projects</p>
              </div>
            </div>
          </button>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6D75A6]/10 dark:bg-[#6D75A6]/15">
                <BookOpen size={16} className="text-[#6D75A6]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Getting started</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">1. Create project &rarr; 2. Add questions &rarr; 3. Run &rarr; 4. Rate</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-3" style={{ letterSpacing: "-0.02em" }}>
            Recent Runs
          </h2>
          <RecentRuns runs={d.recentRuns} />
        </div>
      </div>
    </div>
  );
}
