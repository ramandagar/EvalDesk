"use client";

import { useEffect, useState } from "react";
import { api, type Run, type Project } from "@/lib/client/api";
import { Page, PageHeader, Spinner, Card, Button } from "./kit";

interface CompareResult {
  a: { id: string; passRate: number | null };
  b: { id: string; passRate: number | null };
  delta: { passRate: number };
  changedCount: number;
  rows: Array<{ title: string; aLabel: string | null; bLabel: string | null; changed: boolean }>;
}

const PILL: Record<string, string> = {
  pass: "text-[#5e7a00]", fail: "text-red-600", partial: "text-amber-600",
};

export function ComparePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [projects, setProjects] = useState<Map<string, string>>(new Map());
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ runs }, { projects }] = await Promise.all([api.get<{ runs: Run[] }>("/runs"), api.get<{ projects: Project[] }>("/projects")]);
      setRuns(runs);
      setProjects(new Map(projects.map((p) => [p.id, p.name])));
      if (runs[1]) { setA(runs[1].id); setB(runs[0].id); }
      else if (runs[0]) setB(runs[0].id);
      setLoading(false);
    })();
  }, []);

  async function compare() {
    if (!a || !b) return;
    setBusy(true);
    try {
      setResult(await api.get<CompareResult>(`/compare?a=${a}&b=${b}`));
    } finally {
      setBusy(false);
    }
  }

  const label = (r: Run) => `${projects.get(r.projectId) ?? "Project"} · ${new Date(r.createdAt).toLocaleDateString()} · ${r.passRate ?? "—"}%`;

  if (loading) return <Page><Spinner /></Page>;

  return (
    <Page>
      <PageHeader title="Compare runs" subtitle="See which test cases changed verdict between two runs." />
      <Card className="p-5 mb-6">
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <Select label="Baseline (A)" value={a} onChange={setA} runs={runs} render={label} />
          <Select label="Candidate (B)" value={b} onChange={setB} runs={runs} render={label} />
        </div>
        <Button onClick={compare} disabled={busy || !a || !b || a === b}>{busy ? "Comparing…" : "Compare"}</Button>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="A pass rate" value={`${result.a.passRate ?? "—"}%`} />
            <Stat label="B pass rate" value={`${result.b.passRate ?? "—"}%`} />
            <Stat label="Δ pass rate" value={`${result.delta.passRate >= 0 ? "+" : ""}${result.delta.passRate}%`} accent={result.delta.passRate} />
          </div>
          <p className="text-[13px] text-[#8a8f98] mb-2">{result.changedCount} of {result.rows.length} cases changed verdict.</p>
          <Card>
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {result.rows.map((r, i) => (
                <li key={i} className={`flex items-center justify-between px-4 py-2.5 text-[13px] ${r.changed ? "bg-amber-500/[0.04]" : ""}`}>
                  <span className="truncate text-[#0a0a0a] dark:text-[#f7f8f8]">{r.title}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className={PILL[r.aLabel ?? ""] ?? "text-[#8a8f98]"}>{r.aLabel ?? "—"}</span>
                    <span className="text-[#8a8f98]">→</span>
                    <span className={`font-medium ${PILL[r.bLabel ?? ""] ?? "text-[#8a8f98]"}`}>{r.bLabel ?? "—"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </Page>
  );
}

function Select({ label, value, onChange, runs, render }: { label: string; value: string; onChange: (v: string) => void; runs: Run[]; render: (r: Run) => string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-[#8a8f98]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-3 py-2 text-[13px]">
        <option value="">Select a run…</option>
        {runs.map((r) => <option key={r.id} value={r.id}>{render(r)}</option>)}
      </select>
    </label>
  );
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: number }) {
  const cls = accent === undefined ? "" : accent > 0 ? "text-[#5e7a00]" : accent < 0 ? "text-red-600" : "";
  return (
    <Card className="p-4 text-center">
      <div className="text-[11px] text-[#8a8f98]">{label}</div>
      <div className={`mt-1 text-[22px] font-semibold ${cls || "text-[#0a0a0a] dark:text-[#f7f8f8]"}`}>{value}</div>
    </Card>
  );
}
