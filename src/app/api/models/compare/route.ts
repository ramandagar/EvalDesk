import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { runs, projects, runResults } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

// GET /api/models/compare?projectId=xxx
// Group results by model and return per-model stats
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    // Build base query conditions
    const conditions = projectId
      ? [eq(runs.projectId, projectId), sql`${runs.modelUsed} IS NOT NULL`]
      : [sql`${runs.modelUsed} IS NOT NULL`];

    // Aggregate per-model stats from runs
    const modelStats = await db
      .select({
        model: runs.modelUsed,
        totalRuns: sql<number>`count(*)`,
        avgPassRate: sql<number>`round(avg(${runs.passRate}), 1)`,
        totalPassCount: sql<number>`sum(${runs.passCount})`,
        totalFailCount: sql<number>`sum(${runs.failCount})`,
        totalInputTokens: sql<number>`sum(coalesce(${runs.totalInputTokens}, 0))`,
        totalOutputTokens: sql<number>`sum(coalesce(${runs.totalOutputTokens}, 0))`,
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
      })
      .from(runs)
      .where(and(...conditions))
      .groupBy(runs.modelUsed)
      .orderBy(sql`sum(coalesce(${runs.totalCost}, 0)) desc`);

    // Compute avg response time per model from run_results joined with runs
    const responseTimeStats = await db
      .select({
        model: runs.modelUsed,
        avgResponseTime: sql<number>`round(avg(${runResults.responseTime}), 0)`,
      })
      .from(runs)
      .innerJoin(runResults, eq(runs.id, runResults.runId))
      .where(and(...conditions, sql`${runResults.responseTime} IS NOT NULL`))
      .groupBy(runs.modelUsed);

    // Merge response time into model stats
    const responseTimeMap = new Map(responseTimeStats.map(r => [r.model, r.avgResponseTime]));

    const result = modelStats.map(stat => ({
      model: stat.model,
      totalRuns: stat.totalRuns,
      avgPassRate: stat.avgPassRate,
      totalPassCount: stat.totalPassCount,
      totalFailCount: stat.totalFailCount,
      totalCases: stat.totalPassCount + stat.totalFailCount,
      avgResponseTime: responseTimeMap.get(stat.model) ?? null,
      totalInputTokens: stat.totalInputTokens,
      totalOutputTokens: stat.totalOutputTokens,
      totalCost: stat.totalCost,
    }));

    return NextResponse.json({ models: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
