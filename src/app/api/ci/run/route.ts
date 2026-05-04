import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, runResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeRun } from "@/lib/agent-runner";

// POST /api/ci/run — Trigger a run via API key (for CI/CD)
// Headers: X-EvalDesk-Key: <api_key>
// Body: { "projectId": "xxx", "runName": "PR #123 eval" }
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-evaldesk-key");
  if (!apiKey) {
    return NextResponse.json({ error: "X-EvalDesk-Key header required" }, { status: 401 });
  }

  if (!apiKey.startsWith("evaldesk_")) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { projectId, runName } = body;
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.agentEndpoint) return NextResponse.json({ error: "No agent endpoint configured" }, { status: 400 });

    const result = await executeRun({
      projectId,
      endpoint: project.agentEndpoint,
      apiKey: project.agentApiKey || undefined,
      method: project.agentMethod || undefined,
      headers: project.agentHeaders,
      runName: runName || "CI run",
      triggeredBy: undefined,
    });

    // Fetch results to give CI useful info
    const results = await db.select().from(runResults).where(eq(runResults.runId, result.runId));
    const completed = results.filter(r => r.status === "completed").length;
    const errors = results.filter(r => r.status === "error").length;
    const avgTime = results.filter(r => r.responseTime).length > 0
      ? Math.round(results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length)
      : 0;

    return NextResponse.json({
      id: result.runId,
      totalCases: result.totalCases,
      completed,
      errors,
      avgResponseTime: avgTime,
      status: errors === 0 ? "passed" : errors < result.totalCases ? "partial" : "failed",
      // Note: passRate requires human or judge ratings
      passRate: null,
      passCount: 0,
      failCount: 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to execute run" }, { status: 500 });
  }
}
