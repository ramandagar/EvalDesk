import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, runs, testCases } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const [p] = await db.select({ count: sql<number>`count(*)` }).from(projects);
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(runs);
    const [tc] = await db.select({ count: sql<number>`count(*)` }).from(testCases);

    // Get recent runs with project names
    const recent = await db
      .select({
        id: runs.id,
        name: runs.name,
        status: runs.status,
        passRate: runs.passRate,
        totalCases: runs.totalCases,
        createdAt: runs.createdAt,
        projectId: runs.projectId,
        projectName: projects.name,
      })
      .from(runs)
      .innerJoin(projects, eq(runs.projectId, projects.id))
      .orderBy(desc(runs.createdAt))
      .limit(10);

    // Chart data — last 20 runs pass rates
    const chartRuns = await db
      .select({ name: runs.name, passRate: runs.passRate, createdAt: runs.createdAt })
      .from(runs)
      .where(sql`${runs.passRate} IS NOT NULL`)
      .orderBy(desc(runs.createdAt))
      .limit(20);

    const chartData = chartRuns
      .reverse();

    const recentPassRates = chartData.map((r) => r.passRate || 0);
    const runLabels = chartData.map((r, i) => {
      const d = r.createdAt ? new Date(r.createdAt) : new Date();
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });

    // Overall pass rate
    const [avg] = await db
      .select({ avg: sql<number>`avg(${runs.passRate})` })
      .from(runs)
      .where(sql`${runs.passRate} IS NOT NULL`);

    return NextResponse.json({
      projects: p.count,
      totalRuns: r.count,
      passRate: avg.avg ? Math.round(avg.avg) : null,
      totalCases: tc.count,
      recentPassRates,
      runLabels,
      recentRuns: recent,
    });
  } catch (error) {
    return NextResponse.json({
      projects: 0,
      totalRuns: 0,
      passRate: null,
      totalCases: 0,
      recentPassRates: [],
      runLabels: [],
      recentRuns: [],
    });
  }
}
