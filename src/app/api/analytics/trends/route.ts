import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs } from "@/db/schema";
import { requireAuth } from "@/lib/api-utils";
import { eq, and, sql, desc } from "drizzle-orm";

// GET /api/analytics/trends?projectId=xxx&window=5
// Detect anomalies in pass rate (drops >15% from moving avg)
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const windowSize = parseInt(req.nextUrl.searchParams.get("window") || "5");

  try {
    const projectCondition = projectId ? eq(runs.projectId, projectId) : undefined;

    // Get completed runs with pass rates, ordered chronologically
    const completedRuns = await db
      .select({
        id: runs.id,
        name: runs.name,
        passRate: runs.passRate,
        totalCases: runs.totalCases,
        passCount: runs.passCount,
        failCount: runs.failCount,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .where(
        projectCondition
          ? and(projectCondition, sql`${runs.passRate} IS NOT NULL AND ${runs.status} = 'completed'`)
          : sql`${runs.passRate} IS NOT NULL AND ${runs.status} = 'completed'`
      )
      .orderBy(runs.createdAt);

    if (completedRuns.length < 2) {
      return NextResponse.json({
        anomalies: [],
        trend: "stable" as const,
        runs: completedRuns.map((r) => ({
          ...r,
          movingAvg: r.passRate,
          isAnomaly: false,
        })),
      });
    }

    // Compute moving average and detect anomalies
    const runData = completedRuns.map((r, i) => {
      const start = Math.max(0, i - windowSize);
      const windowRuns = completedRuns.slice(start, i);
      const movingAvg =
        windowRuns.length > 0
          ? windowRuns.reduce((sum, wr) => sum + (wr.passRate || 0), 0) / windowRuns.length
          : r.passRate || 0;

      const drop = movingAvg - (r.passRate || 0);
      const isAnomaly = drop > 15; // >15% drop from moving average

      return {
        ...r,
        movingAvg: Math.round(movingAvg * 10) / 10,
        isAnomaly,
        drop: Math.round(drop * 10) / 10,
      };
    });

    // Determine overall trend
    const anomalies = runData.filter((r) => r.isAnomaly);
    const recentWindow = runData.slice(-Math.min(windowSize, runData.length));
    const olderWindow = runData.slice(0, Math.min(windowSize, runData.length));

    const recentAvg =
      recentWindow.length > 0
        ? recentWindow.reduce((s, r) => s + (r.passRate || 0), 0) / recentWindow.length
        : 0;
    const olderAvg =
      olderWindow.length > 0
        ? olderWindow.reduce((s, r) => s + (r.passRate || 0), 0) / olderWindow.length
        : 0;

    let trend: "improving" | "stable" | "degrading";
    const delta = recentAvg - olderAvg;
    if (delta > 5) {
      trend = "improving";
    } else if (delta < -5) {
      trend = "degrading";
    } else {
      trend = "stable";
    }

    return NextResponse.json({
      anomalies: anomalies.map((a) => ({
        runId: a.id,
        runName: a.name || `Run ${a.id.slice(0, 8)}`,
        passRate: a.passRate,
        movingAvg: a.movingAvg,
        drop: a.drop,
        createdAt: a.createdAt,
        totalCases: a.totalCases,
      })),
      trend,
      trendDelta: Math.round(delta * 10) / 10,
      runs: runData.map((r) => ({
        id: r.id,
        name: r.name,
        passRate: r.passRate,
        movingAvg: r.movingAvg,
        isAnomaly: r.isAnomaly,
        drop: r.drop,
        createdAt: r.createdAt,
      })),
    });
  } catch (e: any) {
    console.error("Trend analytics error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
