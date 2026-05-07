"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";

interface DomainScore {
  category: string;
  total: number;
  pass: number;
  fail: number;
  partial: number;
  unrated: number;
  passRate: number;
  avgResponseTime: number | null;
  avgJudgeScore: number | null;
}

interface DomainScoreBreakdownProps {
  runId: string;
}

export function DomainScoreBreakdown({ runId }: DomainScoreBreakdownProps) {
  const [scores, setScores] = useState<DomainScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallPassRate, setOverallPassRate] = useState<number | null>(null);

  useEffect(() => {
    loadScores();
  }, [runId]);

  async function loadScores() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/scores?runId=${runId}`);
      if (res.ok) {
        const data = await res.json();
        setScores(data.domainScores || []);
        setOverallPassRate(data.overallPassRate);
      }
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
        <span className="ml-2 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Loading scores...</span>
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="card p-8 text-center">
        <BarChart3 className="mx-auto h-6 w-6 text-[#8a8f98] dark:text-[#62666d]" />
        <p className="mt-2 text-[13px] text-[#8a8f98] dark:text-[#62666d]">No scored results yet</p>
      </div>
    );
  }

  const maxRate = 100;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
              Domain Score Breakdown
            </h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
              Pass rate by test case category
            </p>
          </div>
          {overallPassRate !== null && (
            <div className="text-right">
              <p className={`text-[20px] font-semibold ${
                overallPassRate >= 80 ? "text-[#4E9363]" : overallPassRate >= 60 ? "text-amber-500" : "text-red-500"
              }`} style={{ letterSpacing: "-0.03em" }}>
                {overallPassRate}%
              </p>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Overall</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {scores.map((s) => {
          const barColor =
            s.passRate >= 80 ? "#4E9363" : s.passRate >= 60 ? "#D97706" : "#dc2626";
          const barBg =
            s.passRate >= 80 ? "bg-[#4E9363]" : s.passRate >= 60 ? "bg-amber-500" : "bg-red-500";

          return (
            <div key={s.category} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">
                    {s.category}
                  </span>
                  <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d] flex-shrink-0">
                    {s.pass}/{s.total} passed
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  {s.avgJudgeScore !== null && (
                    <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">
                      avg {s.avgJudgeScore}
                    </span>
                  )}
                  {s.avgResponseTime !== null && (
                    <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">
                      {s.avgResponseTime}ms
                    </span>
                  )}
                  <span
                    className="text-[13px] font-semibold min-w-[40px] text-right"
                    style={{ color: barColor }}
                  >
                    {s.passRate}%
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div className="h-2 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barBg}`}
                  style={{ width: `${(s.passRate / maxRate) * 100}%` }}
                />
              </div>
              {/* Sub-bar for pass/fail/partial/unrated */}
              <div className="flex h-1 mt-1 rounded-full overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
                {s.pass > 0 && (
                  <div
                    className="bg-[#4E9363]"
                    style={{ width: `${(s.pass / s.total) * 100}%` }}
                    title={`${s.pass} pass`}
                  />
                )}
                {s.partial > 0 && (
                  <div
                    className="bg-amber-400"
                    style={{ width: `${(s.partial / s.total) * 100}%` }}
                    title={`${s.partial} partial`}
                  />
                )}
                {s.fail > 0 && (
                  <div
                    className="bg-red-400"
                    style={{ width: `${(s.fail / s.total) * 100}%` }}
                    title={`${s.fail} fail`}
                  />
                )}
                {s.unrated > 0 && (
                  <div
                    className="bg-gray-300 dark:bg-gray-600"
                    style={{ width: `${(s.unrated / s.total) * 100}%` }}
                    title={`${s.unrated} unrated`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#4E9363]" />
          <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Pass</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Partial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Fail</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Unrated</span>
        </div>
      </div>
    </div>
  );
}
