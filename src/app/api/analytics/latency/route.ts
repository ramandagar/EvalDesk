import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runResults, runs, testCases } from "@/db/schema";
import { requireAuth } from "@/lib/api-utils";
import { eq, and, sql } from "drizzle-orm";

// GET /api/analytics/latency?projectId=xxx
// Compute p50/p90/p99 from responseTime grouped by testCaseId
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    const projectCondition = projectId ? eq(runs.projectId, projectId) : undefined;

    // Get all results with response times
    const results = await db
      .select({
        testCaseId: runResults.testCaseId,
        responseTime: runResults.responseTime,
        testCaseInput: testCases.input,
        testCaseTitle: testCases.title,
      })
      .from(runResults)
      .innerJoin(runs, eq(runResults.runId, runs.id))
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(
        projectCondition
          ? and(projectCondition, sql`${runResults.responseTime} IS NOT NULL`)
          : sql`${runResults.responseTime} IS NOT NULL`
      );

    // Group by testCaseId
    const grouped = new Map<string, {
      testCaseId: string;
      input: string;
      title: string;
      times: number[];
    }>();

    for (const r of results) {
      if (!grouped.has(r.testCaseId)) {
        grouped.set(r.testCaseId, {
          testCaseId: r.testCaseId,
          input: r.testCaseInput,
          title: r.testCaseTitle,
          times: [],
        });
      }
      grouped.get(r.testCaseId)!.times.push(r.responseTime!);
    }

    // Compute percentiles
    function percentile(sorted: number[], p: number): number {
      if (sorted.length === 0) return 0;
      const idx = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      if (lower === upper) return sorted[lower];
      return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
    }

    const testCasesLatency = Array.from(grouped.values())
      .map((data) => {
        const sorted = [...data.times].sort((a, b) => a - b);
        const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
        return {
          testCaseId: data.testCaseId,
          input: data.input,
          title: data.title,
          sampleSize: sorted.length,
          avg: Math.round(avg),
          p50: Math.round(percentile(sorted, 50)),
          p90: Math.round(percentile(sorted, 90)),
          p99: Math.round(percentile(sorted, 99)),
          min: sorted[0],
          max: sorted[sorted.length - 1],
        };
      })
      .sort((a, b) => b.p99 - a.p99);

    // Overall stats
    const allTimes = results.map((r) => r.responseTime!).sort((a, b) => a - b);
    const overallAvg = allTimes.length > 0
      ? Math.round(allTimes.reduce((s, v) => s + v, 0) / allTimes.length)
      : 0;

    return NextResponse.json({
      testCases: testCasesLatency,
      overall: {
        avg: overallAvg,
        p50: allTimes.length > 0 ? Math.round(percentile(allTimes, 50)) : 0,
        p90: allTimes.length > 0 ? Math.round(percentile(allTimes, 90)) : 0,
        p99: allTimes.length > 0 ? Math.round(percentile(allTimes, 99)) : 0,
        sampleSize: allTimes.length,
      },
    });
  } catch (e: any) {
    console.error("Latency analytics error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
