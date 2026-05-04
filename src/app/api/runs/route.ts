import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs, projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");

  try {
    if (projectId) {
      const result = await db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(desc(runs.createdAt)).limit(limit);
      return NextResponse.json(result);
    }

    // Global: join with projects to get project name
    const result = await db
      .select({
        id: runs.id,
        projectId: runs.projectId,
        name: runs.name,
        status: runs.status,
        totalCases: runs.totalCases,
        passCount: runs.passCount,
        failCount: runs.failCount,
        partialCount: runs.partialCount,
        unratedCount: runs.unratedCount,
        passRate: runs.passRate,
        triggerType: runs.triggerType,
        createdAt: runs.createdAt,
        completedAt: runs.completedAt,
        projectName: projects.name,
      })
      .from(runs)
      .innerJoin(projects, eq(runs.projectId, projects.id))
      .orderBy(desc(runs.createdAt))
      .limit(limit);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
  }
}
