// ============================================================================
// Self-contained, offline-verifiable run report — PURE (no IO). Produces a
// single HTML file with the run summary, agreement/calibration, every test
// case's verdict, and (when signed) the FULL signed certificate embedded in a
// <script type="application/json"> block — so the downloaded file is itself
// verifiable offline (`npx evaldesk verify`) without trusting the rendering.
// Print to PDF from the browser. No headless Chromium needed.
// ============================================================================

export interface ReportRun {
  id: string;
  projectName: string;
  status: string;
  totalCases: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  unratedCount: number;
  passRate: number | null;
  createdAt: number;
}

export interface ReportResultRow {
  title: string;
  input: string;
  agentResponse: string | null;
  aiLabel: string | null;
  humanLabel: string | null;
  finalLabel: string | null;
}

export interface ReportAgreement {
  kappa: number | null;
  kappaMethod: string | null;
  nItems: number | null;
  agreementPct: number | null;
}

export interface ReportInput {
  run: ReportRun;
  rows: ReportResultRow[];
  agreement: ReportAgreement | null;
  certificate: unknown | null; // the signed bundle (embedded for offline verify)
  generatedAt: number;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function pill(label: string | null): string {
  if (!label) return `<span class="pill">—</span>`;
  return `<span class="pill ${esc(label)}">${esc(label)}</span>`;
}
function dt(ms: number): string {
  // Deterministic ISO (no locale) so the report is reproducible.
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function renderHtmlReport(input: ReportInput): string {
  const { run, rows, agreement, certificate } = input;
  const certBlock = certificate
    ? `<section class="cert">
        <h2>Signed certificate</h2>
        <p>This report embeds the cryptographically signed certificate below. Verify it offline with
        <code>npx evaldesk verify cert.json</code> — it never calls back to EvalDesk.</p>
        <details><summary>Show certificate JSON</summary><pre id="cert">${esc(JSON.stringify(certificate, null, 2))}</pre></details>
      </section>`
    : `<section class="cert"><p class="muted">This run is not signed yet — no certificate.</p></section>`;

  const agreementBlock = agreement?.kappa != null
    ? `<div class="kv"><span>Inter-rater κ</span><b>${agreement.kappa.toFixed(2)} (${esc(agreement.kappaMethod ?? "")}, n=${agreement.nItems ?? 0})</b></div>
       <div class="kv"><span>AI-vs-human agreement</span><b>${agreement.agreementPct != null ? Math.round(agreement.agreementPct * 100) + "%" : "—"}</b></div>`
    : "";

  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${esc(r.title || r.input.slice(0, 60))}</td>
        <td class="ans">${esc((r.agentResponse ?? "").slice(0, 240))}</td>
        <td>${pill(r.aiLabel)}</td>
        <td>${pill(r.humanLabel)}</td>
        <td>${pill(r.finalLabel ?? r.aiLabel)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>EvalDesk report — ${esc(run.projectName)} — ${esc(run.id)}</title>
<style>
  body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0a;max-width:900px;margin:40px auto;padding:0 20px}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:28px 0 10px}
  .muted{color:#8a8f98} .brand{color:#5e7a00;font-weight:700}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
  .stat{border:1px solid #eee;border-radius:10px;padding:12px;text-align:center}
  .stat b{display:block;font-size:22px} .kv{display:flex;justify-content:space-between;border-bottom:1px solid #f0f0f0;padding:6px 0}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
  th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  th{color:#8a8f98;font-weight:600;font-size:11px;text-transform:uppercase}
  td.ans{color:#555;max-width:340px}
  .pill{display:inline-block;border-radius:99px;padding:1px 8px;font-size:11px;font-weight:600;border:1px solid #ddd;color:#666}
  .pill.pass{background:#eef6d6;color:#5e7a00;border-color:#cde18a}
  .pill.fail{background:#fdeaea;color:#c33;border-color:#f3b6b6}
  .pill.partial{background:#fdf3e0;color:#b67400;border-color:#f0d6a0}
  pre{background:#fafafa;border:1px solid #eee;border-radius:8px;padding:12px;overflow:auto;font-size:11px}
  @media print{body{margin:0}}
</style></head><body>
  <h1><span class="brand">EvalDesk</span> evaluation report</h1>
  <p class="muted">${esc(run.projectName)} · run ${esc(run.id)} · ${esc(run.status)} · ${dt(run.createdAt)}</p>
  <div class="summary">
    <div class="stat"><b style="color:#5e7a00">${run.passCount}</b>pass</div>
    <div class="stat"><b style="color:#c33">${run.failCount}</b>fail</div>
    <div class="stat"><b style="color:#b67400">${run.partialCount}</b>partial</div>
    <div class="stat"><b>${run.passRate ?? "—"}${run.passRate != null ? "%" : ""}</b>pass rate</div>
  </div>
  ${agreementBlock ? `<h2>Agreement</h2>${agreementBlock}` : ""}
  <h2>Results (${rows.length})</h2>
  <table><thead><tr><th>Test case</th><th>Agent response</th><th>AI</th><th>Human</th><th>Final</th></tr></thead>
  <tbody>${rowsHtml}</tbody></table>
  ${certBlock}
  <p class="muted" style="margin-top:32px;font-size:11px">Generated ${dt(input.generatedAt)} · This file is self-verifiable; the embedded certificate is the artifact of record.</p>
</body></html>`;
}

/** Flat CSV of the per-case results. */
export function renderCsv(rows: ReportResultRow[]): string {
  const head = ["title", "input", "agent_response", "ai_label", "human_label", "final_label"];
  const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [head.join(",")];
  for (const r of rows) lines.push([r.title, r.input, r.agentResponse, r.aiLabel, r.humanLabel, r.finalLabel].map(q).join(","));
  return lines.join("\n");
}
