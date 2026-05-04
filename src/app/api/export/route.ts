import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs, runResults, testCases, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/export?runId=xxx&format=csv|html
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  const format = req.nextUrl.searchParams.get("format") || "csv";

  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  try {
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

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
        input: testCases.input,
        expectedOutput: testCases.expectedOutput,
        category: testCases.category,
      })
      .from(runResults)
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(eq(runResults.runId, runId));

    if (format === "csv") return exportCSV(run, project, results);
    if (format === "html") return exportHTML(run, project, results);
    return NextResponse.json({ error: "Format must be csv or html" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function escCSV(str: string | null): string {
  if (!str) return "";
  const s = String(str).replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

function exportCSV(run: any, project: any, results: any[]) {
  const header = ["Test Case", "Category", "Input", "Expected Output", "Agent Response", "Status", "Response Time (ms)", "Human Rating", "Human Comment", "Judge Rating", "Judge Score"];
  const rows = results.map(r => [
    escCSV(r.input.slice(0, 80)),
    escCSV(r.category),
    escCSV(r.input),
    escCSV(r.expectedOutput),
    escCSV(r.agentResponse),
    r.status,
    r.responseTime?.toString() || "",
    r.humanRating || "",
    escCSV(r.humanComment),
    r.judgeRating || "",
    r.judgeScore?.toString() || "",
  ].join(","));

  const summaryRow = [
    "", "", "", "", "", "",
    `Pass Rate: ${run.passRate ?? "N/A"}%`,
    `Pass: ${run.passCount}`,
    `Fail: ${run.failCount}`,
    `Partial: ${run.partialCount}`,
    `Total: ${run.totalCases}`,
  ].join(",");

  const csv = [header.join(","), ...rows, "", summaryRow].join("\n");
  const filename = `${(project?.name || "evaldesk").replace(/\s+/g, "_")}_${run.name || run.id.slice(0, 8)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function exportHTML(run: any, project: any, results: any[]) {
  const ratingColor = (r: string | null) => {
    if (r === "pass") return "color:#16a34a;font-weight:600";
    if (r === "fail") return "color:#dc2626;font-weight:600";
    if (r === "partial") return "color:#d97706;font-weight:600";
    return "color:#999";
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${project?.name || "EvalDesk"} — ${run.name || "Run Report"}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:40px;color:#111;max-width:900px;margin:40px auto}
  h1{font-size:24px;margin-bottom:4px}
  h2{font-size:16px;color:#666;font-weight:400;margin-top:30px}
  .meta{color:#888;font-size:13px;margin-bottom:20px}
  .stats{display:flex;gap:20px;margin:20px 0}
  .stat{text-align:center;padding:12px 20px;border:1px solid #eee;border-radius:8px}
  .stat b{display:block;font-size:28px}
  .stat span{font-size:11px;color:#888}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
  th{text-align:left;padding:8px 10px;background:#f7f7f7;border-bottom:2px solid #eee;font-size:11px;text-transform:uppercase;color:#888}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  td.response{max-width:300px;white-space:pre-wrap;word-break:break-word;font-size:12px;color:#444}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:11px;color:#bbb}
  @media print{body{margin:20px}.stats{gap:10px}.stat{padding:8px 12px}td.response{max-width:250px}}
</style></head><body>
<h1>${project?.name || "EvalDesk"}</h1>
<p class="meta">${run.name || "Run Report"} · ${new Date(run.createdAt).toLocaleDateString()} · ${new Date(run.createdAt).toLocaleTimeString()}</p>
<div class="stats">
  <div class="stat"><b>${run.passRate ?? "—"}%</b><span>Pass Rate</span></div>
  <div class="stat"><b>${run.passCount}</b><span>Pass</span></div>
  <div class="stat"><b>${run.failCount}</b><span>Fail</span></div>
  <div class="stat"><b>${run.partialCount}</b><span>Partial</span></div>
  <div class="stat"><b>${run.totalCases}</b><span>Total</span></div>
</div>
<h2>Results</h2>
<table>
  <tr><th>#</th><th>Category</th><th>Input</th><th>Agent Response</th><th>Time</th><th>Rating</th><th>Comment</th></tr>
  ${results.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${r.category || "—"}</td>
    <td style="max-width:200px">${escHTML(r.input)}</td>
    <td class="response">${r.status === "error" ? `<span style="color:red">Error: ${escHTML(r.errorMessage)}</span>` : escHTML(r.agentResponse)}</td>
    <td>${r.responseTime ? r.responseTime + "ms" : "—"}</td>
    <td style="${ratingColor(r.humanRating)}">${r.humanRating || "—"}</td>
    <td style="color:#888;font-size:11px">${escHTML(r.humanComment) || ""}</td>
  </tr>`).join("")}
</table>
<div class="footer">Generated by EvalDesk · ${new Date().toLocaleDateString()}</div>
</body></html>`;

  const filename = `${(project?.name || "evaldesk").replace(/\s+/g, "_")}_${run.name || run.id.slice(0, 8)}.html`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function escHTML(s: string | null): string {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
