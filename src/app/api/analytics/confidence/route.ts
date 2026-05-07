import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runResults, runs, testCases } from "@/db/schema";
import { requireAuth } from "@/lib/api-utils";
import { eq, and, sql } from "drizzle-orm";

// Wilson score confidence interval for pass rates
// Returns lower bound of the 95% confidence interval
function wilsonScore(passes: number, total: number): { lower: number; upper: number; point: number } {
  if (total === 0) return { lower: 0, upper: 0, point: 0 };

  const z = 1.96; // 95% confidence
  const pHat = passes / total;
  const denominator = 1 + (z * z) / total;
  const centre = pHat + (z * z) / (2 * total);
  const spread = z * Math.sqrt((pHat * (1 - pHat) + (z * z) / (4 * total)) / total);

  return {
    lower: Math.max(0, Math.round(((centre - spread) / denominator) * 1000) / 1000),
    upper: Math.min(1, Math.round(((centre + spread) / denominator) * 1000) / 1000),
    point: Math.round(pHat * 1000) / 1000,
  };
}

// GET /api/analytics/confidence?projectId=xxx
// Wilson score confidence interval for pass rates
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    const projectCondition = projectId ? eq(runs.projectId, projectId) : undefined;

    // Get all rated results
    const results = await db
      .select({
        testCaseId: runResults.testCaseId,
        humanRating: runResults.humanRating,
        judgeRating: runResults.judgeRating,
        testCaseInput: testCases.input,
        testCaseTitle: testCases.title,
      })
      .from(runResults)
      .innerJoin(runs, eq(runResults.runId, runs.id))
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(
        projectCondition
          ? and(
              projectCondition,
              sql`${runResults.humanRating} IS NOT NULL OR ${runResults.judgeRating} IS NOT NULL`
            )
          : sql`${runResults.humanRating} IS NOT NULL OR ${runResults.judgeRating} IS NOT NULL`
      );

    // Overall stats
    let totalPasses = 0;
    let totalRated = 0;
    for (const r of results) {
      const rating = r.humanRating || r.judgeRating;
      if (rating) {
        totalRated++;
        if (rating === "pass") totalPasses++;
      }
    }
    const overall = wilsonScore(totalPasses, totalRated);

    // Per-test-case stats
    const caseMap = new Map<string, {
      testCaseId: string;
      input: string;
      title: string;
      passes: number;
      total: number;
    }>();

    for (const r of results) {
      const rating = r.humanRating || r.judgeRating;
      if (!rating) continue;

      if (!caseMap.has(r.testCaseId)) {
        caseMap.set(r.testCaseId, {
          testCaseId: r.testCaseId,
          input: r.testCaseInput,
          title: r.testCaseTitle,
          passes: 0,
          total: 0,
        });
      }
      const data = caseMap.get(r.testCaseId)!;
      data.total++;
      if (rating === "pass") data.passes++;
    }

    const perCase = Array.from(caseMap.values())
      .map((data) => {
        const { lower, upper, point } = wilsonScore(data.passes, data.total);
        return {
          testCaseId: data.testCaseId,
          input: data.input,
          title: data.title,
          sampleSize: data.total,
          passCount: data.passes,
          passRate: point,
          confidence: {
            lower,
            upper,
          },
          // The "confidence score" is the Wilson lower bound (conservative estimate)
          confidenceScore: Math.round(lower * 100),
        };
      })
      .sort((a, b) => a.confidenceScore - b.confidenceScore);

    return NextResponse.json({
      overall: {
        sampleSize: totalRated,
        passCount: totalPasses,
        passRate: overall.point,
        confidence: {
          lower: overall.lower,
          upper: overall.upper,
        },
        confidenceScore: Math.round(overall.lower * 100),
      },
      perCase,
    });
  } catch (e: any) {
    console.error("Confidence analytics error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
