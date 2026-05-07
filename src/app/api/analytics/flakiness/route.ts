import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runResults, runs, testCases } from "@/db/schema";
import { requireAuth } from "@/lib/api-utils";
import { eq, and, desc, sql } from "drizzle-orm";

// GET /api/analytics/flakiness?projectId=xxx
// Detect flaky tests: count how often ratings flip between pass/fail across runs
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    // Build conditions for the project filter
    const projectCondition = projectId ? eq(runs.projectId, projectId) : undefined;

    // Get all run results joined with runs and test cases, ordered chronologically
    const results = await db
      .select({
        testCaseId: runResults.testCaseId,
        rating: runResults.humanRating,
        judgeRating: runResults.judgeRating,
        runCreatedAt: runs.createdAt,
        testCaseInput: testCases.input,
        testCaseTitle: testCases.title,
        runId: runResults.runId,
        runName: runs.name,
      })
      .from(runResults)
      .innerJoin(runs, eq(runResults.runId, runs.id))
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(projectCondition ? and(projectCondition, sql`${runResults.humanRating} IS NOT NULL`) : sql`${runResults.humanRating} IS NOT NULL`)
      .orderBy(runResults.testCaseId, runs.createdAt);

    // Group results by testCaseId
    const grouped = new Map<string, {
      testCaseId: string;
      input: string;
      title: string;
      ratings: { rating: string; runId: string; runName: string | null; runCreatedAt: Date | null }[];
    }>();

    for (const r of results) {
      if (!grouped.has(r.testCaseId)) {
        grouped.set(r.testCaseId, {
          testCaseId: r.testCaseId,
          input: r.testCaseInput,
          title: r.testCaseTitle,
          ratings: [],
        });
      }
      grouped.get(r.testCaseId)!.ratings.push({
        rating: r.rating!,
        runId: r.runId,
        runName: r.runName,
        runCreatedAt: r.runCreatedAt,
      });
    }

    // Calculate flip counts
    const flakyItems: Array<{
      testCaseId: string;
      input: string;
      title: string;
      flipCount: number;
      flipRate: number;
      totalRuns: number;
      lastFlips: Array<{ from: string; to: string; runName: string | null }>;
    }> = [];

    for (const [tcId, data] of grouped) {
      if (data.ratings.length < 2) continue;

      let flipCount = 0;
      const lastFlips: Array<{ from: string; to: string; runName: string | null }> = [];

      for (let i = 1; i < data.ratings.length; i++) {
        const prev = data.ratings[i - 1].rating;
        const curr = data.ratings[i].rating;
        // A "flip" is when rating changes between pass and fail specifically
        const prevBinary = prev === "pass" ? "pass" : "fail";
        const currBinary = curr === "pass" ? "pass" : "fail";
        if (prevBinary !== currBinary) {
          flipCount++;
          if (lastFlips.length < 5) {
            lastFlips.push({
              from: prev,
              to: curr,
              runName: data.ratings[i].runName,
            });
          }
        }
      }

      const totalRuns = data.ratings.length;
      const flipRate = totalRuns > 1 ? flipCount / (totalRuns - 1) : 0;

      flakyItems.push({
        testCaseId: tcId,
        input: data.input,
        title: data.title,
        flipCount,
        flipRate: Math.round(flipRate * 1000) / 1000,
        totalRuns,
        lastFlips,
      });
    }

    // Sort by flip rate descending, then flip count descending
    flakyItems.sort((a, b) => b.flipRate - a.flipRate || b.flipCount - a.flipCount);

    return NextResponse.json({ flaky: flakyItems });
  } catch (e: any) {
    console.error("Flakiness analytics error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
