import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { runs, projects } from "@/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";

// GET /api/costs?projectId=xxx&period=7d|30d|90d
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const period = req.nextUrl.searchParams.get("period") || "30d";

  // Parse period to days
  let days = 30;
  if (period === "7d") days = 7;
  else if (period === "90d") days = 90;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Base conditions
    const conditions = projectId
      ? [eq(runs.projectId, projectId), gte(runs.createdAt, since)]
      : [gte(runs.createdAt, since)];

    // Aggregate totals
    const [totals] = await db
      .select({
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
        totalInputTokens: sql<number>`sum(coalesce(${runs.totalInputTokens}, 0))`,
        totalOutputTokens: sql<number>`sum(coalesce(${runs.totalOutputTokens}, 0))`,
        runCount: sql<number>`count(*)`,
      })
      .from(runs)
      .where(and(...conditions));

    // Daily cost breakdown
    const dailyCosts = await db
      .select({
        date: sql<string>`date(${runs.createdAt}, 'unixepoch')`,
        cost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
        inputTokens: sql<number>`sum(coalesce(${runs.totalInputTokens}, 0))`,
        outputTokens: sql<number>`sum(coalesce(${runs.totalOutputTokens}, 0))`,
        runs: sql<number>`count(*)`,
      })
      .from(runs)
      .where(and(...conditions))
      .groupBy(sql`date(${runs.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${runs.createdAt}, 'unixepoch')`);

    // Per-model costs
    const modelCosts = await db
      .select({
        model: runs.modelUsed,
        totalCost: sql<number>`round(sum(coalesce(${runs.totalCost}, 0)), 4)`,
        totalInputTokens: sql<number>`sum(coalesce(${runs.totalInputTokens}, 0))`,
        totalOutputTokens: sql<number>`sum(coalesce(${runs.totalOutputTokens}, 0))`,
        runCount: sql<number>`count(*)`,
      })
      .from(runs)
      .where(and(...conditions, sql`${runs.modelUsed} IS NOT NULL`))
      .groupBy(runs.modelUsed)
      .orderBy(sql`sum(coalesce(${runs.totalCost}, 0)) desc`);

    // Fill in missing days in the range
    const dailyMap = new Map(dailyCosts.map(d => [d.date, d]));
    const filledDaily: typeof dailyCosts = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const entry = dailyMap.get(dateStr);
      filledDaily.push(entry ?? {
        date: dateStr,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        runs: 0,
      });
    }

    // Cost trend: compare first half to second half
    const midPoint = Math.floor(filledDaily.length / 2);
    const firstHalfCost = filledDaily.slice(0, midPoint).reduce((s, d) => s + d.cost, 0);
    const secondHalfCost = filledDaily.slice(midPoint).reduce((s, d) => s + d.cost, 0);
    const costTrend = firstHalfCost > 0
      ? ((secondHalfCost - firstHalfCost) / firstHalfCost) * 100
      : 0;

    return NextResponse.json({
      totals: {
        totalCost: totals.totalCost ?? 0,
        totalInputTokens: totals.totalInputTokens ?? 0,
        totalOutputTokens: totals.totalOutputTokens ?? 0,
        totalTokens: (totals.totalInputTokens ?? 0) + (totals.totalOutputTokens ?? 0),
        runCount: totals.runCount ?? 0,
      },
      daily: filledDaily,
      byModel: modelCosts,
      trend: {
        percentChange: Math.round(costTrend * 10) / 10,
        direction: costTrend > 5 ? "up" : costTrend < -5 ? "down" : "stable",
      },
      period,
      days,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
