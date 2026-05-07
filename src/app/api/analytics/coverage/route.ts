import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases, runResults, runs } from "@/db/schema";
import { requireAuth } from "@/lib/api-utils";
import { eq, and, sql } from "drizzle-orm";

// GET /api/analytics/coverage?projectId=xxx
// Group test cases by category and tags, count total and evaluated
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    const projectCondition = projectId ? eq(testCases.projectId, projectId) : undefined;

    // Get all test cases with their project filter
    const allTestCases = await db
      .select({
        id: testCases.id,
        category: testCases.category,
        tags: testCases.tags,
      })
      .from(testCases)
      .where(projectCondition);

    // Get all distinct testCaseIds that have at least one rated result
    const evaluatedCaseIds = new Set<string>();
    if (projectId) {
      const evaluated = await db
        .selectDistinct({ testCaseId: runResults.testCaseId })
        .from(runResults)
        .innerJoin(runs, eq(runResults.runId, runs.id))
        .where(
          and(
            eq(runs.projectId, projectId),
            sql`${runResults.humanRating} IS NOT NULL OR ${runResults.judgeRating} IS NOT NULL`
          )
        );
      for (const r of evaluated) {
        evaluatedCaseIds.add(r.testCaseId);
      }
    } else {
      const evaluated = await db
        .selectDistinct({ testCaseId: runResults.testCaseId })
        .from(runResults)
        .where(sql`${runResults.humanRating} IS NOT NULL OR ${runResults.judgeRating} IS NOT NULL`);
      for (const r of evaluated) {
        evaluatedCaseIds.add(r.testCaseId);
      }
    }

    // Group by category
    const categoryMap = new Map<string, { totalCases: number; evaluatedCases: number }>();
    // Group by tags
    const tagMap = new Map<string, { totalCases: number; evaluatedCases: number }>();

    for (const tc of allTestCases) {
      const cat = tc.category || "Uncategorized";
      const isEvaluated = evaluatedCaseIds.has(tc.id);

      // Category aggregation
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { totalCases: 0, evaluatedCases: 0 });
      }
      const catData = categoryMap.get(cat)!;
      catData.totalCases++;
      if (isEvaluated) catData.evaluatedCases++;

      // Tags aggregation
      let tags: string[] = [];
      try {
        tags = tc.tags ? JSON.parse(tc.tags) : [];
      } catch {
        tags = [];
      }
      if (tags.length === 0) tags = ["Untagged"];

      for (const tag of tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { totalCases: 0, evaluatedCases: 0 });
        }
        const tagData = tagMap.get(tag)!;
        tagData.totalCases++;
        if (isEvaluated) tagData.evaluatedCases++;
      }
    }

    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        totalCases: data.totalCases,
        evaluatedCases: data.evaluatedCases,
        coveragePercent: data.totalCases > 0
          ? Math.round((data.evaluatedCases / data.totalCases) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.totalCases - a.totalCases);

    const tags = Array.from(tagMap.entries())
      .map(([name, data]) => ({
        name,
        totalCases: data.totalCases,
        evaluatedCases: data.evaluatedCases,
        coveragePercent: data.totalCases > 0
          ? Math.round((data.evaluatedCases / data.totalCases) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.totalCases - a.totalCases);

    const totalAll = allTestCases.length;
    const evaluatedAll = allTestCases.filter((tc) => evaluatedCaseIds.has(tc.id)).length;

    return NextResponse.json({
      categories,
      tags,
      summary: {
        totalCases: totalAll,
        evaluatedCases: evaluatedAll,
        coveragePercent: totalAll > 0
          ? Math.round((evaluatedAll / totalAll) * 1000) / 10
          : 0,
      },
    });
  } catch (e: any) {
    console.error("Coverage analytics error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
