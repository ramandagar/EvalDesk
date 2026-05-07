import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs, runResults, testCases, projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/embed/data?projectId=xxx
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Get latest completed run
    const [latestRun] = await db
      .select()
      .from(runs)
      .where(eq(runs.projectId, projectId))
      .orderBy(desc(runs.createdAt))
      .limit(1);

    if (!latestRun) {
      return NextResponse.json({
        project: { name: project.name, description: project.description },
        latestRun: null,
        results: [],
      });
    }

    // Get results with test case info
    const results = await db
      .select({
        id: runResults.id,
        testCaseId: runResults.testCaseId,
        agentResponse: runResults.agentResponse,
        responseTime: runResults.responseTime,
        status: runResults.status,
        humanRating: runResults.humanRating,
        judgeRating: runResults.judgeRating,
        judgeScore: runResults.judgeScore,
        category: testCases.category,
        title: testCases.title,
        input: testCases.input,
      })
      .from(runResults)
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(eq(runResults.runId, latestRun.id));

    // Compute domain breakdown
    const categories = new Map<string, { pass: number; total: number }>();
    for (const r of results) {
      const cat = r.category || "Uncategorized";
      const existing = categories.get(cat) || { pass: 0, total: 0 };
      existing.total++;
      if (r.humanRating === "pass" || r.judgeRating === "pass") existing.pass++;
      categories.set(cat, existing);
    }

    const domainScores = Array.from(categories.entries()).map(([category, { pass, total }]) => ({
      category,
      total,
      pass,
      fail: total - pass,
      passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    }));

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      latestRun: {
        id: latestRun.id,
        name: latestRun.name,
        status: latestRun.status,
        passRate: latestRun.passRate,
        passCount: latestRun.passCount,
        failCount: latestRun.failCount,
        partialCount: latestRun.partialCount,
        totalCases: latestRun.totalCases,
        modelUsed: latestRun.modelUsed,
        createdAt: latestRun.createdAt?.toISOString(),
        completedAt: latestRun.completedAt?.toISOString(),
      },
      domainScores,
      results: results.map((r) => ({
        testCaseId: r.testCaseId,
        title: r.title,
        category: r.category,
        status: r.status,
        humanRating: r.humanRating,
        judgeRating: r.judgeRating,
        judgeScore: r.judgeScore,
        responseTime: r.responseTime,
      })),
      embedUrl: `/embed/${project.id}`,
      badgeUrl: `/api/embed/badge?projectId=${project.id}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
