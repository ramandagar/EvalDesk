"use client";

// CalibrationPanel + AgreementPanel — the two headline cards no incumbent
// renders: the AI-vs-human calibration gap (with the audit-sampled τ + cold-
// start honesty) and the inter-rater kappa with Landis–Koch bands + a bootstrap
// CI. All values are precomputed by the worker; these just read finished rows.

import { useEffect, useState } from "react";

interface JudgeCalibration {
  judgeModel: string;
  agreementPct: number | null;
  weightedKappa: number | null;
  confusion: number[][] | null;
  bias: { bias?: string; coldStartReason?: string | null } | null;
  meanAbsScoreError: number | null;
  tau: number | null;
  published: boolean;
  sampleN: number | null;
  auditSampleN: number | null;
}
interface AgreementMetric {
  kappa: number | null;
  kappaMethod: string | null;
  nItems: number | null;
  ciLo: number | null;
  ciHi: number | null;
}

const LABELS = ["fail", "partial", "pass"];

function band(k: number): { text: string; cls: string } {
  if (k < 0) return { text: "poor", cls: "text-red-600" };
  if (k < 0.2) return { text: "slight", cls: "text-red-500" };
  if (k < 0.4) return { text: "fair", cls: "text-amber-600" };
  if (k < 0.6) return { text: "moderate", cls: "text-amber-500" };
  if (k < 0.8) return { text: "substantial", cls: "text-[#5e7a00]" };
  return { text: "almost perfect", cls: "text-[#5e7a00]" };
}

export function WedgePanels({ projectId, orgId }: { projectId: string; orgId: string }) {
  const [cal, setCal] = useState<JudgeCalibration | null>(null);
  const [agr, setAgr] = useState<AgreementMetric | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/calibration`, {
          headers: { "x-org-id": orgId },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCal(data.calibration);
          setAgr(data.agreement);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, [projectId, orgId]);

  if (!loaded) return <div className="text-sm text-neutral-400">Loading metrics…</div>;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <CalibrationCard cal={cal} />
      <AgreementCard agr={agr} />
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-neutral-400 mb-4">{subtitle}</div>
      {children}
    </div>
  );
}

function CalibrationCard({ cal }: { cal: JudgeCalibration | null }) {
  if (!cal) return <Card title="AI-vs-human calibration" subtitle="how often the judge agrees with experts"><Empty /></Card>;
  const coldStart = !cal.published;
  return (
    <Card title="AI-vs-human calibration" subtitle="the gap between the AI judge and your experts">
      {coldStart && (
        <div className="mb-3 text-xs px-2 py-1.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30">
          Cold start ({cal.bias?.coldStartReason?.replace(/-/g, " ") ?? "gathering data"}) — τ not yet trustworthy, not cited in certificates.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Agreement" value={cal.agreementPct != null ? `${Math.round(cal.agreementPct * 100)}%` : "—"} />
        <Stat label="Weighted κ" value={cal.weightedKappa != null ? cal.weightedKappa.toFixed(2) : "—"} />
        <Stat label="Auto-finalize τ" value={cal.published && cal.tau != null ? cal.tau.toFixed(2) : "—"} />
        <Stat label="Bias" value={cal.bias?.bias ?? "—"} />
        <Stat label="Audit pairs" value={`${cal.auditSampleN ?? 0}`} />
        <Stat label="Mean score err" value={cal.meanAbsScoreError != null ? cal.meanAbsScoreError.toFixed(1) : "—"} />
      </div>
      {cal.confusion && <Confusion m={cal.confusion} />}
    </Card>
  );
}

function AgreementCard({ agr }: { agr: AgreementMetric | null }) {
  if (!agr || agr.kappa == null) return <Card title="Inter-rater agreement" subtitle="Cohen's / Fleiss' kappa across reviewers"><Empty /></Card>;
  const b = band(agr.kappa);
  return (
    <Card title="Inter-rater agreement" subtitle={`${agr.kappaMethod ?? "kappa"} across ${agr.nItems ?? 0} items`}>
      <div className="flex items-end gap-3">
        <div className={`text-4xl font-bold ${b.cls}`}>{agr.kappa.toFixed(2)}</div>
        <div className="pb-1">
          <div className={`text-sm font-medium ${b.cls}`}>{b.text}</div>
          {agr.ciLo != null && agr.ciHi != null && (
            <div className="text-xs text-neutral-400">95% CI [{agr.ciLo.toFixed(2)}, {agr.ciHi.toFixed(2)}]</div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-1 text-[10px] text-neutral-400">
        {["poor", "slight", "fair", "moderate", "substantial", "perfect"].map((t, i) => (
          <span key={t} className={`flex-1 text-center py-0.5 rounded ${i === bandIndex(agr.kappa!) ? "bg-[#ABC83A]/20 text-[#5e7a00] font-medium" : "bg-neutral-100 dark:bg-neutral-800"}`}>
            {t}
          </span>
        ))}
      </div>
    </Card>
  );
}

function bandIndex(k: number): number {
  if (k < 0) return 0;
  if (k < 0.2) return 1;
  if (k < 0.4) return 2;
  if (k < 0.6) return 3;
  if (k < 0.8) return 4;
  return 5;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function Confusion({ m }: { m: number[][] }) {
  const max = Math.max(1, ...m.flat());
  return (
    <div className="mt-4">
      <div className="text-xs text-neutral-400 mb-1">Confusion (judge ↓ / human →)</div>
      <table className="text-xs">
        <tbody>
          {m.map((row, i) => (
            <tr key={i}>
              <td className="pr-2 text-neutral-400">{LABELS[i]}</td>
              {row.map((v, j) => (
                <td key={j} className="w-8 h-8 text-center align-middle rounded" style={{ background: `rgba(171,200,58,${v / max})` }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-neutral-400 py-6 text-center">No data yet — run an eval and have experts review some results.</div>;
}
