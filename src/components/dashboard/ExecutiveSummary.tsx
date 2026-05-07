"use client";

import {
  TrendingUp, TrendingDown, Minus, FolderKanban, Play, CheckCircle,
  Clock, DollarSign, Coins, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface TrendIconProps {
  direction: string;
  value: number;
}

function TrendIndicator({ direction, value }: TrendIconProps) {
  if (direction === "up" && value > 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        <ArrowUpRight size={12} /> +{Math.abs(Math.round(value * 10) / 10)}
      </span>
    );
  }
  if (direction === "down" && value < 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
        <ArrowDownRight size={12} /> {Math.round(value * 10) / 10}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-[#8a8f98] dark:text-[#62666d]">
      <Minus size={12} /> Stable
    </span>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  suffix?: string;
  trend?: { direction: string; value: number };
  color?: string;
}

function MetricCard({ icon, label, value, suffix, trend, color }: MetricCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
        {trend && <TrendIndicator direction={trend.direction} value={trend.value} />}
      </div>
      <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>
        {value ?? "\u2014"}{suffix || ""}
      </p>
      <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">{label}</p>
    </div>
  );
}

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

interface ProjectEntry {
  id: string;
  name: string;
  avgPassRate: number;
  totalRuns: number;
  totalCost: number;
}

export function ExecutiveSummary({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">No data available</p>
        <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Complete some runs to see executive metrics.</p>
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-5">
      {/* Main metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={<FolderKanban className="h-4 w-4 text-[#ABC83A]" />}
          label="Total projects"
          value={d.totalProjects}
          trend={d.trends?.runs}
        />
        <MetricCard
          icon={<Play className="h-4 w-4 text-[#6FA3A5]" />}
          label="Total runs"
          value={d.totalRuns}
          trend={d.trends?.runs}
        />
        <MetricCard
          icon={<CheckCircle className="h-4 w-4 text-[#4E9363]" />}
          label="Overall pass rate"
          value={d.overallPassRate}
          suffix="%"
          trend={d.trends?.passRate}
        />
        <MetricCard
          icon={<Clock className="h-4 w-4 text-[#6D75A6]" />}
          label="Avg response time"
          value={d.avgResponseTime ? `${d.avgResponseTime}ms` : null}
          trend={d.trends?.passRate}
        />
      </div>

      {/* Cost and token metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          icon={<DollarSign className="h-4 w-4 text-[#ABC83A]" />}
          label="Total cost"
          value={formatCost(d.totalCost ?? 0)}
          trend={d.trends?.cost}
        />
        <MetricCard
          icon={<Coins className="h-4 w-4 text-amber-500" />}
          label="Total tokens"
          value={formatTokens(d.totalTokens ?? 0)}
        />
        <MetricCard
          icon={<CheckCircle className="h-4 w-4 text-[#4E9363]" />}
          label="Total test cases"
          value={d.totalTestCases}
        />
      </div>

      {/* Weekly trend summary */}
      {d.trends && (
        <div className="card p-4">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-3" style={{ letterSpacing: "-0.02em" }}>
            Weekly Trends
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Runs</p>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{d.trends.previousWeek?.runs ?? 0}</span>
                <span className="text-[#8a8f98] dark:text-[#62666d]">&rarr;</span>
                <span className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{d.trends.recentWeek?.runs ?? 0}</span>
                <TrendIndicator direction={d.trends.runs?.direction} value={d.trends.runs?.value} />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Pass Rate</p>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{d.trends.previousWeek?.avgPassRate ?? 0}%</span>
                <span className="text-[#8a8f98] dark:text-[#62666d]">&rarr;</span>
                <span className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{d.trends.recentWeek?.avgPassRate ?? 0}%</span>
                <TrendIndicator direction={d.trends.passRate?.direction} value={d.trends.passRate?.value} />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider mb-1">Cost</p>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{formatCost(d.trends.previousWeek?.totalCost ?? 0)}</span>
                <span className="text-[#8a8f98] dark:text-[#62666d]">&rarr;</span>
                <span className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{formatCost(d.trends.recentWeek?.totalCost ?? 0)}</span>
                <TrendIndicator direction={d.trends.cost?.direction} value={d.trends.cost?.value} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top and bottom projects */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top projects */}
        <div className="card p-5">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-3" style={{ letterSpacing: "-0.02em" }}>
            <TrendingUp size={14} className="inline mr-1.5 text-[#4E9363]" />
            Top Performing Projects
          </h3>
          {(d.topProjects?.length > 0) ? (
            <div className="space-y-2">
              {d.topProjects.map((p: ProjectEntry) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">{p.name}</p>
                    <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{p.totalRuns} run{p.totalRuns !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="text-[18px] font-semibold text-[#4E9363]" style={{ letterSpacing: "-0.03em" }}>{p.avgPassRate}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8a8f98] dark:text-[#62666d] py-4 text-center">No completed runs yet.</p>
          )}
        </div>

        {/* Bottom projects */}
        <div className="card p-5">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-3" style={{ letterSpacing: "-0.02em" }}>
            <TrendingDown size={14} className="inline mr-1.5 text-red-500" />
            Needs Attention
          </h3>
          {(d.bottomProjects?.length > 0) ? (
            <div className="space-y-2">
              {d.bottomProjects.map((p: ProjectEntry) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">{p.name}</p>
                    <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{p.totalRuns} run{p.totalRuns !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="text-[18px] font-semibold text-red-500" style={{ letterSpacing: "-0.03em" }}>{p.avgPassRate}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8a8f98] dark:text-[#62666d] py-4 text-center">No completed runs yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
