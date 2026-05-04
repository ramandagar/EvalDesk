"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";

interface Run {
  id: string; name: string | null; status: string; passRate: number | null;
  totalCases: number; createdAt: string; projectId: string; projectName?: string;
}

export function RecentRuns({ runs }: { runs: Run[] }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-[#8a8f98] dark:text-[#62666d]">No runs yet. Create a project and run your first test.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {runs.map((run) => {
        const StatusIcon = run.status === "completed" ? CheckCircle2 : run.status === "running" ? Loader2 : AlertCircle;
        const statusColor = run.status === "completed" ? "text-[#4E9363]" : run.status === "running" ? "text-[#6FA3A5]" : "text-red-400";
        return (
          <Link
            key={run.id}
            href={`/projects/${run.projectId}/runs`}
            className="flex items-center gap-3 card p-3 card-hover"
          >
            <StatusIcon className={`h-4 w-4 shrink-0 ${statusColor} ${run.status === "running" ? "animate-spin" : ""}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] truncate font-medium" style={{ letterSpacing: "-0.01em" }}>
                {run.name || `Run ${run.id.slice(0, 8)}`}
              </p>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">
                {run.projectName || "Project"} &middot; {run.totalCases} cases
              </p>
            </div>
            {run.passRate !== null && (
              <span className={`text-[12px] font-medium ${run.passRate >= 80 ? "text-[#4E9363]" : run.passRate >= 50 ? "text-amber-500" : "text-red-400"}`}>
                {run.passRate}%
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-[#8a8f98] dark:text-[#62666d]">
              <Clock size={10} />
              {formatRelativeTime(new Date(run.createdAt))}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
