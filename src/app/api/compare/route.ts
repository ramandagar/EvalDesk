import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs, runResults, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/compare?runA=xxx&runB=yyy
// Returns side-by-side comparison of two runs for the same project
export async function GET(req: NextRequest) {
  const runAId = req.nextUrl.searchParams.get("runA");
  const runBId = req.nextUrl.searchParams.get("runB");

  if (!runAId || !runBId) {
    return NextResponse.json({ error: "runA and runB query params required" }, { status: 400 });
  }
  if (runAId === runBId) {
    return NextResponse.json({ error: "Cannot compare a run with itself" }, { status: 400 });
  }

  try {
    // Fetch both runs
    const [runA] = await db.select().from(runs).where(eq(runs.id, runAId));
    const [runB] = await db.select().from(runs).where(eq(runs.id, runBId));

    if (!runA || !runB) {
      return NextResponse.json({ error: "One or both runs not found" }, { status: 404 });
    }
    if (runA.projectId !== runB.projectId) {
      return NextResponse.json({ error: "Runs must be from the same project" }, { status: 400 });
    }

    // Fetch results for both runs, joined with test case
    const fetchResults = async (runId: string) => {
      return db
        .select({
          testCaseId: runResults.testCaseId,
          agentResponse: runResults.agentResponse,
          responseTime: runResults.responseTime,
          status: runResults.status,
          errorMessage: runResults.errorMessage,
          humanRating: runResults.humanRating,
          judgeRating: runResults.judgeRating,
          judgeScore: runResults.judgeScore,
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
          category: testCases.category,
        })
        .from(runResults)
        .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
        .where(eq(runResults.runId, runId));
    };

    const resultsA = await fetchResults(runAId);
    const resultsB = await fetchResults(runBId);

    // Build lookup by testCaseId
    const mapB = new Map(resultsB.map((r) => [r.testCaseId, r]));

    // Match results by testCaseId
    const comparisons = resultsA.map((a) => {
      const b = mapB.get(a.testCaseId);
      let change: string = "new";
      if (!b) {
        change = "removed";
      } else if (!a.humanRating && !b.humanRating) {
        change = "unrated";
      } else if (!a.humanRating || !b.humanRating) {
        change = "unrated";
      } else if (a.humanRating === b.humanRating) {
        change = "same";
      } else if (
        (a.humanRating === "fail" && (b.humanRating === "pass" || b.humanRating === "partial")) ||
        (a.humanRating === "partial" && b.humanRating === "pass")
      ) {
        change = "improved";
      } else {
        change = "regressed";
      }

      return {
        testCaseId: a.testCaseId,
        input: a.input,
        expectedOutput: a.expectedOutput,
        category: a.category,
        a: {
          response: a.agentResponse,
          responseTime: a.responseTime,
          status: a.status,
          rating: a.humanRating,
          judgeRating: a.judgeRating,
          judgeScore: a.judgeScore,
        },
        b: b
          ? {
              response: b.agentResponse,
              responseTime: b.responseTime,
              status: b.status,
              rating: b.humanRating,
              judgeRating: b.judgeRating,
              judgeScore: b.judgeScore,
            }
          : null,
        change,
      };
    });

    // Summary stats
    const summary = {
      total: comparisons.length,
      improved: comparisons.filter((c) => c.change === "improved").length,
      regressed: comparisons.filter((c) => c.change === "regressed").length,
      same: comparisons.filter((c) => c.change === "same").length,
      unrated: comparisons.filter((c) => c.change === "unrated").length,
      newCases: comparisons.filter((c) => c.change === "new").length,
      removed: comparisons.filter((c) => c.change === "removed").length,
      passRateA: runA.passRate,
      passRateB: runB.passRate,
      passRateDelta: (runB.passRate ?? 0) - (runA.passRate ?? 0),
    };

    return NextResponse.json({
      runA: { id: runA.id, name: runA.name, createdAt: runA.createdAt, passRate: runA.passRate, totalCases: runA.totalCases },
      runB: { id: runB.id, name: runB.name, createdAt: runB.createdAt, passRate: runB.passRate, totalCases: runB.totalCases },
      projectId: runA.projectId,
      comparisons,
      summary,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
