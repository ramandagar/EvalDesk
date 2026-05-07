import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { runResults, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { evaluateRAG } from "@/lib/rag-evaluator";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { runResultId, context, response, expectedAnswer } = body;

    if (!runResultId) {
      return NextResponse.json({ error: "runResultId required" }, { status: 400 });
    }
    if (!context) {
      return NextResponse.json({ error: "context required" }, { status: 400 });
    }
    if (!response) {
      return NextResponse.json({ error: "response required" }, { status: 400 });
    }

    // Fetch the run result and its test case to get the query/input
    const [result] = await db
      .select({
        id: runResults.id,
        runId: runResults.runId,
        agentResponse: runResults.agentResponse,
        testCaseId: runResults.testCaseId,
        input: testCases.input,
        expectedOutput: testCases.expectedOutput,
      })
      .from(runResults)
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(eq(runResults.id, runResultId));

    if (!result) {
      return NextResponse.json({ error: "Run result not found" }, { status: 404 });
    }

    const query = result.input;
    const effectiveExpectedAnswer = expectedAnswer || result.expectedOutput || undefined;

    const scores = await evaluateRAG({
      context,
      response: response || result.agentResponse || "",
      query,
      expectedAnswer: effectiveExpectedAnswer,
    });

    // Store RAG scores in judgeReasoning as JSON (reusing existing columns)
    const ragPayload = JSON.stringify({
      type: "rag_eval",
      faithfulness: scores.faithfulness,
      relevance: scores.relevance,
      contextRecall: scores.contextRecall,
      overall: scores.overall,
      faithfulnessReasoning: scores.faithfulnessReasoning,
      relevanceReasoning: scores.relevanceReasoning,
      contextRecallReasoning: scores.contextRecallReasoning,
    });

    await db
      .update(runResults)
      .set({
        judgeReasoning: ragPayload,
        judgeScore: Math.round(scores.overall * 100),
        judgeRating: scores.overall >= 0.7 ? "pass" : scores.overall >= 0.4 ? "partial" : "fail",
      })
      .where(eq(runResults.id, runResultId));

    return NextResponse.json({
      runResultId,
      faithfulness: scores.faithfulness,
      relevance: scores.relevance,
      contextRecall: scores.contextRecall,
      overall: scores.overall,
      overallScore: Math.round(scores.overall * 100),
      faithfulnessReasoning: scores.faithfulnessReasoning,
      relevanceReasoning: scores.relevanceReasoning,
      contextRecallReasoning: scores.contextRecallReasoning,
    });
  } catch (error: any) {
    console.error("RAG eval error:", error);
    return NextResponse.json(
      { error: error.message || "RAG evaluation failed" },
      { status: 500 }
    );
  }
}
