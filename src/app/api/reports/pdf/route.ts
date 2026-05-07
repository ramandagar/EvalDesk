import { NextRequest, NextResponse } from "next/server";
import { fetchReportData, generatePDFHtml } from "@/lib/pdf-report";

// GET /api/reports/pdf?runId=xxx
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  try {
    const data = await fetchReportData(runId);
    if (!data) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const html = generatePDFHtml(data);
    const projectSlug = (data.project?.name || "evaldesk").replace(/\s+/g, "_");
    const runSlug = data.run.name || data.run.id.slice(0, 8);
    const filename = `${projectSlug}_${runSlug}_report.html`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
