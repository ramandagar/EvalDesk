import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs, projects } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

// GET /api/regressions — detect pass rate drops across all projects
// GET /api/regressions?projectId=xxx — detect for a single project
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    // Get all projects (or just one)
    const targetProjects = projectId
      ? await db.select().from(projects).where(eq(projects.id, projectId))
      : await db.select().from(projects);

    const regressions: any[] = [];

    for (const project of targetProjects) {
      // Get last 2 completed runs for this project
      const lastRuns = await db
        .select()
        .from(runs)
        .where(eq(runs.projectId, project.id))
        .orderBy(desc(runs.createdAt))
        .limit(2);

      if (lastRuns.length < 2) continue;

      const latest = lastRuns[0];
      const previous = lastRuns[1];

      // Both runs must have a pass rate to compare
      if (latest.passRate === null || previous.passRate === null) continue;

      const delta = latest.passRate - previous.passRate;

      if (delta < 0) {
        regressions.push({
          projectId: project.id,
          projectName: project.name,
          latestRunId: latest.id,
          latestRunName: latest.name || `Run ${latest.id.slice(0, 8)}`,
          latestRunDate: latest.createdAt,
          latestPassRate: latest.passRate,
          previousPassRate: previous.passRate,
          delta,
          totalCases: latest.totalCases,
          passCount: latest.passCount,
          failCount: latest.failCount,
        });
      }
    }

    // Sort by worst regression first
    regressions.sort((a, b) => a.delta - b.delta);

    return NextResponse.json({ regressions, count: regressions.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
