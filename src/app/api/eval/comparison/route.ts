import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { runResults, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "@/lib/comparison-evaluator";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { resultAId, resultBId, criteria } = body;

    if (!resultAId || !resultBId) {
      return NextResponse.json(
        { error: "resultAId and resultBId required" },
        { status: 400 }
      );
    }

    if (resultAId === resultBId) {
      return NextResponse.json(
        { error: "Cannot compare a result with itself" },
        { status: 400 }
      );
    }

    // Fetch both results with their test case inputs
    const fetchResult = async (id: string) => {
      const [row] = await db
        .select({
          id: runResults.id,
          agentResponse: runResults.agentResponse,
          testCaseId: runResults.testCaseId,
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
        })
        .from(runResults)
        .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
        .where(eq(runResults.id, id));
      return row;
    };

    const [resultA, resultB] = await Promise.all([
      fetchResult(resultAId),
      fetchResult(resultBId),
    ]);

    if (!resultA) {
      return NextResponse.json({ error: "Result A not found" }, { status: 404 });
    }
    if (!resultB) {
      return NextResponse.json({ error: "Result B not found" }, { status: 404 });
    }

    const responseA = resultA.agentResponse || "";
    const responseB = resultB.agentResponse || "";
    const input = resultA.input || resultB.input || "";

    const criteriaList: string[] = Array.isArray(criteria) ? criteria : [];

    const comparisonResult = await compare({
      responseA,
      responseB,
      input,
      criteria: criteriaList,
    });

    return NextResponse.json({
      resultAId,
      resultBId,
      ...comparisonResult,
    });
  } catch (error: any) {
    console.error("Comparison error:", error);
    return NextResponse.json(
      { error: error.message || "Comparison failed" },
      { status: 500 }
    );
  }
}
