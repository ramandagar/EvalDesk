"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Page, PageHeader, Spinner, Card } from "./kit";

interface Analytics {
  totals: { runs: number; cases: number; pass: number; fail: number; partial: number; needsReview: number; passRate: number | null };
  labelDistribution: { pass: number; fail: number; partial: number };
  trend: Array<{ runId: string; project: string; passRate: number | null; at: number }>;
  perProject: Array<{ project: string; runs: number; passRate: number | null }>;
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Analytics>("/analytics").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Page><Spinner /></Page>;
  if (!data) return <Page><PageHeader title="Analytics" /><Card className="p-8 text-center text-[13px] text-[#8a8f98]">No data yet.</Card></Page>;

  const dist = data.labelDistribution;
  const distTotal = dist.pass + dist.fail + dist.partial || 1;
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.passRate ?? 0));

  return (
    <Page>
      <PageHeader title="Analytics" subtitle="Eval quality across all your projects." />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat label="Runs" value={data.totals.runs} />
        <Stat label="Cases evaluated" value={data.totals.cases} />
        <Stat label="Overall pass rate" value={data.totals.passRate != null ? `${data.totals.passRate}%` : "—"} accent />
        <Stat label="Awaiting review" value={data.totals.needsReview} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Verdict distribution</h3>
          <div className="flex h-3 rounded-full overflow-hidden mb-2">
            <div style={{ width: `${(dist.pass / distTotal) * 100}%` }} className="bg-[#ABC83A]" />
            <div style={{ width: `${(dist.partial / distTotal) * 100}%` }} className="bg-amber-400" />
            <div style={{ width: `${(dist.fail / distTotal) * 100}%` }} className="bg-red-400" />
          </div>
          <div className="flex gap-4 text-[12px]">
            <span className="text-[#5e7a00]">● {dist.pass} pass</span>
            <span className="text-amber-600">● {dist.partial} partial</span>
            <span className="text-red-600">● {dist.fail} fail</span>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">By project</h3>
          {data.perProject.length === 0 ? <p className="text-[12px] text-[#8a8f98]">No runs yet.</p> : (
            <ul className="space-y-1.5">
              {data.perProject.map((p, i) => (
                <li key={i} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#0a0a0a] dark:text-[#f7f8f8] truncate">{p.project}</span>
                  <span className="text-[#8a8f98]">{p.runs} runs · {p.passRate != null ? `${p.passRate}%` : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-[13px] font-semibold mb-4">Pass-rate trend</h3>
        {data.trend.length === 0 ? <p className="text-[12px] text-[#8a8f98]">No finished runs yet.</p> : (
          <div className="flex items-end gap-1.5 h-32">
            {data.trend.slice(-40).map((t) => (
              <div key={t.runId} className="flex-1 group relative" title={`${t.project}: ${t.passRate}%`}>
                <div style={{ height: `${((t.passRate ?? 0) / maxTrend) * 100}%` }} className="w-full rounded-t bg-[#ABC83A]/70 group-hover:bg-[#ABC83A] transition-colors min-h-[2px]" />
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-[#8a8f98]">{label}</div>
      <div className={`mt-1 text-[24px] font-semibold ${accent ? "text-[#5e7a00]" : "text-[#0a0a0a] dark:text-[#f7f8f8]"}`}>{value}</div>
    </Card>
  );
}
