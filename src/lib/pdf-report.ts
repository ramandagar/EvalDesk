import { runs, runResults, testCases, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

function escHTML(s: string | null): string {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ratingColor(r: string | null): string {
  if (r === "pass") return "#4E9363";
  if (r === "fail") return "#dc2626";
  if (r === "partial") return "#d97706";
  return "#999";
}

function ratingBg(r: string | null): string {
  if (r === "pass") return "rgba(78,147,99,0.1)";
  if (r === "fail") return "rgba(220,38,38,0.1)";
  if (r === "partial") return "rgba(217,119,6,0.1)";
  return "rgba(0,0,0,0.03)";
}

export interface PDFReportData {
  run: typeof runs.$inferSelect;
  project: typeof projects.$inferSelect | undefined;
  results: Array<{
    id: string;
    agentResponse: string | null;
    responseTime: number | null;
    status: string;
    errorMessage: string | null;
    humanRating: string | null;
    humanComment: string | null;
    judgeRating: string | null;
    judgeScore: number | null;
    judgeReasoning: string | null;
    input: string | null;
    expectedOutput: string | null;
    category: string | null;
  }>;
}

export async function fetchReportData(runId: string): Promise<PDFReportData | null> {
  const { db } = await import("@/db");

  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return null;

  const [project] = await db.select().from(projects).where(eq(projects.id, run.projectId));

  const results = await db
    .select({
      id: runResults.id,
      agentResponse: runResults.agentResponse,
      responseTime: runResults.responseTime,
      status: runResults.status,
      errorMessage: runResults.errorMessage,
      humanRating: runResults.humanRating,
      humanComment: runResults.humanComment,
      judgeRating: runResults.judgeRating,
      judgeScore: runResults.judgeScore,
      judgeReasoning: runResults.judgeReasoning,
      input: testCases.input,
      expectedOutput: testCases.expectedOutput,
      category: testCases.category,
    })
    .from(runResults)
    .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
    .where(eq(runResults.runId, runId));

  return { run, project, results };
}

export function generatePDFHtml(data: PDFReportData): string {
  const { run, project, results } = data;
  const passRate = run.passRate ?? 0;
  const projectName = project?.name || "EvalDesk";
  const runName = run.name || `Run ${run.id.slice(0, 8)}`;
  const date = run.createdAt ? new Date(run.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A";

  // Compute domain breakdown
  const categories = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const cat = r.category || "Uncategorized";
    const existing = categories.get(cat) || { pass: 0, total: 0 };
    existing.total++;
    if (r.humanRating === "pass" || r.judgeRating === "pass") existing.pass++;
    categories.set(cat, existing);
  }

  const domainRows = Array.from(categories.entries()).map(([cat, { pass, total }]) => {
    const rate = total > 0 ? Math.round((pass / total) * 100) : 0;
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;color:#d0d6e0;font-size:13px">${escHTML(cat)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;text-align:center;font-size:13px;color:#d0d6e0">${total}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;text-align:center;font-size:13px;color:#d0d6e0">${pass}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;text-align:center;font-size:13px;font-weight:600;color:${ratingColor(rate >= 80 ? "pass" : rate >= 60 ? "partial" : "fail")}">${rate}%</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;">
          <div style="background:#1a1b1e;border-radius:4px;height:8px;overflow:hidden">
            <div style="background:${ratingColor(rate >= 80 ? "pass" : rate >= 60 ? "partial" : "fail")};height:100%;width:${rate}%;border-radius:4px"></div>
          </div>
        </td>
      </tr>`;
  }).join("");

  const resultRows = results.map((r, i) => {
    const effectiveRating = r.humanRating || r.judgeRating || null;
    const time = r.responseTime ? `${r.responseTime}ms` : "--";
    const response = r.status === "error"
      ? `<span style="color:#dc2626">Error: ${escHTML(r.errorMessage)}</span>`
      : escHTML(r.agentResponse);

    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;color:#62666d;font-size:12px">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;color:#d0d6e0;font-size:12px">${escHTML(r.category || "--")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;color:#d0d6e0;font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML((r.input || "").slice(0, 100))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;color:#d0d6e0;font-size:12px;max-width:260px;white-space:pre-wrap;word-break:break-word">${response}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;color:#62666d;font-size:12px">${time}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;">
          <span style="background:${ratingBg(effectiveRating)};color:${ratingColor(effectiveRating)};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${effectiveRating || "--"}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1b1e;color:#62666d;font-size:12px">${r.judgeScore !== null ? r.judgeScore : "--"}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${escHTML(projectName)} - ${escHTML(runName)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; background: #09090b; color: #f7f8f8; max-width: 900px; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #62666d; border-bottom: 2px solid #1a1b1e; }
</style>
</head><body>

<!-- Header -->
<div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid #1a1b1e">
  <div style="background:rgba(171,200,58,0.12);border-radius:12px;padding:10px;display:flex;align-items:center;justify-content:center">
    <div style="width:24px;height:24px;background:#ABC83A;border-radius:4px"></div>
  </div>
  <div>
    <h1 style="font-size:22px;font-weight:700;margin:0;letter-spacing:-0.04em;color:#f7f8f8">${escHTML(projectName)}</h1>
    <p style="font-size:13px;color:#62666d;margin:4px 0 0">${escHTML(runName)} &middot; ${date}</p>
  </div>
</div>

<!-- Summary -->
<div style="display:flex;gap:16px;margin-bottom:32px">
  <div style="flex:1;background:#0f1011;border:1px solid #1a1b1e;border-radius:12px;padding:16px;text-align:center">
    <p style="font-size:32px;font-weight:700;margin:0;letter-spacing:-0.04em;color:${passRate >= 80 ? "#4E9363" : passRate >= 60 ? "#d97706" : "#dc2626"}">${passRate}%</p>
    <p style="font-size:11px;color:#62666d;margin:4px 0 0">Pass Rate</p>
  </div>
  <div style="flex:1;background:#0f1011;border:1px solid #1a1b1e;border-radius:12px;padding:16px;text-align:center">
    <p style="font-size:32px;font-weight:700;margin:0;letter-spacing:-0.04em;color:#4E9363">${run.passCount}</p>
    <p style="font-size:11px;color:#62666d;margin:4px 0 0">Pass</p>
  </div>
  <div style="flex:1;background:#0f1011;border:1px solid #1a1b1e;border-radius:12px;padding:16px;text-align:center">
    <p style="font-size:32px;font-weight:700;margin:0;letter-spacing:-0.04em;color:#dc2626">${run.failCount}</p>
    <p style="font-size:11px;color:#62666d;margin:4px 0 0">Fail</p>
  </div>
  <div style="flex:1;background:#0f1011;border:1px solid #1a1b1e;border-radius:12px;padding:16px;text-align:center">
    <p style="font-size:32px;font-weight:700;margin:0;letter-spacing:-0.04em;color:#d97706">${run.partialCount}</p>
    <p style="font-size:11px;color:#62666d;margin:4px 0 0">Partial</p>
  </div>
  <div style="flex:1;background:#0f1011;border:1px solid #1a1b1e;border-radius:12px;padding:16px;text-align:center">
    <p style="font-size:32px;font-weight:700;margin:0;letter-spacing:-0.04em;color:#f7f8f8">${run.totalCases}</p>
    <p style="font-size:11px;color:#62666d;margin:4px 0 0">Total</p>
  </div>
</div>

${run.modelUsed ? `<p style="font-size:12px;color:#62666d;margin-bottom:24px">Model: ${escHTML(run.modelUsed)}</p>` : ""}

<!-- Domain Breakdown -->
${categories.size > 0 ? `
<h2 style="font-size:16px;font-weight:600;margin:0 0 12px;letter-spacing:-0.02em">Score by Category</h2>
<table style="margin-bottom:32px">
  <tr><th>Category</th><th style="text-align:center">Cases</th><th style="text-align:center">Pass</th><th style="text-align:center">Rate</th><th>Progress</th></tr>
  ${domainRows}
</table>
` : ""}

<!-- Results -->
<h2 style="font-size:16px;font-weight:600;margin:0 0 12px;letter-spacing:-0.02em">Detailed Results</h2>
<table>
  <tr><th>#</th><th>Category</th><th>Input</th><th>Agent Response</th><th>Time</th><th>Rating</th><th>Score</th></tr>
  ${resultRows}
</table>

<!-- Footer -->
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #1a1b1e;display:flex;justify-content:space-between;align-items:center">
  <p style="font-size:11px;color:#62666d;margin:0">Generated by EvalDesk &middot; ${new Date().toLocaleDateString()}</p>
  <div style="display:flex;align-items:center;gap:6px">
    <div style="width:12px;height:12px;background:#ABC83A;border-radius:3px"></div>
    <span style="font-size:11px;color:#62666d">EvalDesk</span>
  </div>
</div>

</body></html>`;

  return html;
}
