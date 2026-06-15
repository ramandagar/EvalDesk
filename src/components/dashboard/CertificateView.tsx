"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Download, ArrowLeft } from "lucide-react";
import { api } from "@/lib/client/api";
import { Page, PageHeader, Spinner, ErrorBanner, Card } from "./kit";

interface Cert {
  id: string;
  runId: string;
  contentHash: string;
  signature: string;
  signingKeyId: string;
  algo: string;
  publicKeyPem: string;
  canonicalJson: string | null;
  payload: Record<string, unknown>;
  signedAt: number;
}

export function CertificateView({ runId }: { runId: string }) {
  const [cert, setCert] = useState<Cert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ certificate: Cert }>(`/runs/${runId}/certificate`).then((d) => setCert(d.certificate)).catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <Page><Spinner /></Page>;
  if (!cert) {
    return (
      <Page>
        <Link href={`/review/${runId}`} className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8a8f98]"><ArrowLeft size={14} /> Back</Link>
        <ErrorBanner message={error ?? "No certificate for this run yet — it is signed after sign-off quorum is met."} />
      </Page>
    );
  }

  const agreement = (cert.payload.agreement ?? {}) as Record<string, unknown>;
  const verdicts = (cert.payload.verdicts ?? []) as Array<Record<string, unknown>>;
  const reviewers = (cert.payload.reviewers ?? []) as Array<Record<string, unknown>>;

  function download() {
    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaldesk-certificate-${cert!.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Page>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8a8f98]"><ArrowLeft size={14} /> Projects</Link>
      <PageHeader
        title="Evaluation certificate"
        subtitle="Ed25519-signed, offline-verifiable record of this run."
        action={<button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-[#ABC83A] px-3.5 py-2 text-[13px] font-medium text-[#09090b]"><Download size={14} /> Download JSON</button>}
      />

      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 text-[#5e7a00] mb-3"><ShieldCheck size={18} /> <span className="text-[14px] font-semibold">Signed &amp; verifiable</span></div>
        <Row label="Run" value={cert.runId} mono />
        <Row label="Algorithm" value={cert.algo} />
        <Row label="Signing key" value={cert.signingKeyId} mono />
        <Row label="Content hash (SHA-256)" value={cert.contentHash} mono />
        <Row label="Signature" value={cert.signature.slice(0, 44) + "…"} mono />
      </Card>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Agreement</h3>
          <Row label="Kappa" value={fmt(agreement.kappa)} />
          <Row label="Method" value={String(agreement.method ?? "—")} />
          <Row label="n" value={String(agreement.n ?? "—")} />
          <Row label="Weighting" value={String(agreement.weightingScheme ?? "—")} />
        </Card>
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Reviewers</h3>
          {reviewers.length === 0 ? <p className="text-[12px] text-[#8a8f98]">—</p> : reviewers.map((r, i) => (
            <Row key={i} label={String(r.role ?? "reviewer")} value={String(r.reviewerId ?? "")} mono />
          ))}
        </Card>
      </div>

      <Card className="p-5 mb-4">
        <h3 className="text-[13px] font-semibold mb-3">Verdicts ({verdicts.length})</h3>
        <ul className="space-y-1">
          {verdicts.map((v, i) => (
            <li key={i} className="flex justify-between text-[12.5px]">
              <span className="font-mono text-[#8a8f98]">{String(v.runResultId).slice(0, 12)}…</span>
              <span className="text-[#0a0a0a] dark:text-[#f7f8f8]">final: <b>{String(v.finalLabel)}</b>{v.judgeLabel ? ` · judge: ${v.judgeLabel}` : ""}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h3 className="text-[13px] font-semibold mb-2">Verify offline (zero-egress)</h3>
        <p className="text-[12.5px] text-[#8a8f98] mb-2">The signed JSON bundles the issuer public key — verification never calls back to EvalDesk.</p>
        <pre className="rounded-lg bg-black/[0.04] dark:bg-white/[0.04] p-3 text-[12px] font-mono overflow-x-auto">npx evaldesk verify evaldesk-certificate-{cert.runId}.json</pre>
      </Card>
    </Page>
  );
}

function fmt(v: unknown): string {
  return typeof v === "number" ? v.toFixed(3) : v == null ? "—" : String(v);
}
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-[12.5px]">
      <span className="text-[#8a8f98] shrink-0">{label}</span>
      <span className={`text-right text-[#0a0a0a] dark:text-[#f7f8f8] truncate ${mono ? "font-mono text-[11.5px]" : ""}`}>{value}</span>
    </div>
  );
}
