import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runResults, testCases, runs } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/reports/scores?runId=xxx
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  try {
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    // Get all results with test case categories
    const results = await db
      .select({
        testCaseId: runResults.testCaseId,
        agentResponse: runResults.agentResponse,
        responseTime: runResults.responseTime,
        status: runResults.status,
        humanRating: runResults.humanRating,
        judgeRating: runResults.judgeRating,
        judgeScore: runResults.judgeScore,
        category: testCases.category,
        input: testCases.input,
      })
      .from(runResults)
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(eq(runResults.runId, runId));

    // Group by category
    const categories = new Map<
      string,
      {
        pass: number;
        fail: number;
        partial: number;
        unrated: number;
        total: number;
        totalResponseTime: number;
        responseTimeCount: number;
        totalScore: number;
        scoreCount: number;
      }
    >();

    for (const r of results) {
      const cat = r.category || "Uncategorized";
      const existing = categories.get(cat) || {
        pass: 0,
        fail: 0,
        partial: 0,
        unrated: 0,
        total: 0,
        totalResponseTime: 0,
        responseTimeCount: 0,
        totalScore: 0,
        scoreCount: 0,
      };

      existing.total++;
      const rating = r.humanRating || r.judgeRating;
      if (rating === "pass") existing.pass++;
      else if (rating === "fail") existing.fail++;
      else if (rating === "partial") existing.partial++;
      else existing.unrated++;

      if (r.responseTime) {
        existing.totalResponseTime += r.responseTime;
        existing.responseTimeCount++;
      }
      if (r.judgeScore !== null) {
        existing.totalScore += r.judgeScore;
        existing.scoreCount++;
      }

      categories.set(cat, existing);
    }

    const domainScores = Array.from(categories.entries()).map(([category, stats]) => ({
      category,
      total: stats.total,
      pass: stats.pass,
      fail: stats.fail,
      partial: stats.partial,
      unrated: stats.unrated,
      passRate: stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0,
      avgResponseTime:
        stats.responseTimeCount > 0 ? Math.round(stats.totalResponseTime / stats.responseTimeCount) : null,
      avgJudgeScore:
        stats.scoreCount > 0 ? Math.round(stats.totalScore / stats.scoreCount) : null,
    }));

    // Sort by pass rate descending
    domainScores.sort((a, b) => b.passRate - a.passRate);

    return NextResponse.json({
      runId: run.id,
      runName: run.name,
      overallPassRate: run.passRate,
      domainScores,
      totalCategories: domainScores.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
