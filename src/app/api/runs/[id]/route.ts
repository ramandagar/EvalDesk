import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs, runResults, testCases } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [run] = await db.select().from(runs).where(eq(runs.id, id));
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Get results joined with test case data
    const results = await db
      .select({
        id: runResults.id,
        testCaseId: runResults.testCaseId,
        agentResponse: runResults.agentResponse,
        responseTime: runResults.responseTime,
        status: runResults.status,
        errorMessage: runResults.errorMessage,
        humanRating: runResults.humanRating,
        humanComment: runResults.humanComment,
        judgeRating: runResults.judgeRating,
        judgeScore: runResults.judgeScore,
        judgeReasoning: runResults.judgeReasoning,
        testCase: {
          id: testCases.id,
          title: testCases.title,
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
          category: testCases.category,
        },
      })
      .from(runResults)
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(eq(runResults.runId, id));

    return NextResponse.json({
      ...run,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
