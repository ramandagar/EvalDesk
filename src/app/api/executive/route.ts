import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { projects, runs, testCases, runResults } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

// GET /api/executive — Executive dashboard data aggregated across all projects
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Overall totals
    const [projectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
    const [runCount] = await db.select({ count: sql<number>`count(*)` }).from(runs);
    const [tcCount] = await db.select({ count: sql<number>`count(*)` }).from(testCases);

    // Overall pass rate
    const [avgPassRate] = await db
      .select({ avg: sql<number>`round(avg(${runs.passRate}), 1)` })
      .from(runs)
      .where(sql`${runs.passRate} IS NOT NULL`);

    // Average response time across all run results
    const [avgResp] = await db
      .select({ avg: sql<number>`round(avg(${runResults.responseTime}), 0)` })
      .from(runResults)
      .where(sql`${runResults.responseTime} IS NOT NULL`);

    // Total tokens and cost
    const [totals] = await db
      .select({
        totalInputTokens: sql<number>`sum(coalesce(${runs.totalInputTokens}, 0))`,
        totalOutputTokens: sql<number>`sum(coalesce(${runs.totalOutputTokens}, 0))`,
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
      })
      .from(runs);

    const totalTokens = (totals.totalInputTokens ?? 0) + (totals.totalOutputTokens ?? 0);

    // Recent trend: last 7 days
    const [recentWeek] = await db
      .select({
        runs: sql<number>`count(*)`,
        avgPassRate: sql<number>`round(avg(${runs.passRate}), 1)`,
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
      })
      .from(runs)
      .where(gte(runs.createdAt, sevenDaysAgo));

    // Previous 7 days
    const [prevWeek] = await db
      .select({
        runs: sql<number>`count(*)`,
        avgPassRate: sql<number>`round(avg(${runs.passRate}), 1)`,
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
      })
      .from(runs)
      .where(and(gte(runs.createdAt, fourteenDaysAgo), lte(runs.createdAt, sevenDaysAgo)));

    // Compute trend direction
    const passRateTrend = (recentWeek.avgPassRate ?? 0) - (prevWeek.avgPassRate ?? 0);
    const costTrend = (recentWeek.totalCost ?? 0) - (prevWeek.totalCost ?? 0);
    const runsTrend = (recentWeek.runs ?? 0) - (prevWeek.runs ?? 0);

    // Top performing projects (by avg pass rate, min 1 completed run)
    const topProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        avgPassRate: sql<number>`round(avg(${runs.passRate}), 1)`,
        totalRuns: sql<number>`count(*)`,
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
      })
      .from(projects)
      .innerJoin(runs, eq(projects.id, runs.projectId))
      .where(sql`${runs.passRate} IS NOT NULL`)
      .groupBy(projects.id, projects.name)
      .having(sql`count(*) >= 1`)
      .orderBy(sql`avg(${runs.passRate}) desc`)
      .limit(5);

    // Bottom performing projects
    const bottomProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        avgPassRate: sql<number>`round(avg(${runs.passRate}), 1)`,
        totalRuns: sql<number>`count(*)`,
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
      })
      .from(projects)
      .innerJoin(runs, eq(projects.id, runs.projectId))
      .where(sql`${runs.passRate} IS NOT NULL`)
      .groupBy(projects.id, projects.name)
      .having(sql`count(*) >= 1`)
      .orderBy(sql`avg(${runs.passRate}) asc`)
      .limit(5);

    return NextResponse.json({
      totalProjects: projectCount.count,
      totalRuns: runCount.count,
      overallPassRate: avgPassRate.avg ?? null,
      totalTestCases: tcCount.count,
      avgResponseTime: avgResp.avg ?? null,
      totalTokens,
      totalCost: totals.totalCost ?? 0,
      trends: {
        passRate: { value: passRateTrend, direction: passRateTrend > 0 ? "up" : passRateTrend < 0 ? "down" : "stable" },
        cost: { value: costTrend, direction: costTrend > 0 ? "up" : costTrend < 0 ? "down" : "stable" },
        runs: { value: runsTrend, direction: runsTrend > 0 ? "up" : runsTrend < 0 ? "down" : "stable" },
        recentWeek: {
          runs: recentWeek.runs ?? 0,
          avgPassRate: recentWeek.avgPassRate ?? 0,
          totalCost: recentWeek.totalCost ?? 0,
        },
        previousWeek: {
          runs: prevWeek.runs ?? 0,
          avgPassRate: prevWeek.avgPassRate ?? 0,
          totalCost: prevWeek.totalCost ?? 0,
        },
      },
      topProjects,
      bottomProjects,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
