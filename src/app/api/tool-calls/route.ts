import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { toolCallsLog, runResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseToolCalls, evaluateToolCall } from "@/lib/tool-call-parser";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const runResultId = url.searchParams.get("runResultId");
  if (!runResultId) return NextResponse.json({ error: "runResultId required" }, { status: 400 });

  const calls = await db.select().from(toolCallsLog).where(eq(toolCallsLog.runResultId, runResultId));
  return NextResponse.json(calls);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { runResultId, expectedTools } = body;
  if (!runResultId) return NextResponse.json({ error: "runResultId required" }, { status: 400 });

  const [result] = await db.select().from(runResults).where(eq(runResults.id, runResultId));
  if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 });

  // Parse tool calls from response
  const parsed = parseToolCalls(result.agentResponse || "");

  // Save to DB and evaluate if expected tools provided
  let evaluated = 0;
  let valid = 0;

  for (const call of parsed) {
    let isValid: number | null = null;
    if (expectedTools && Array.isArray(expectedTools)) {
      const expected = expectedTools.find((e: any) => e.name === call.name);
      if (expected) {
        isValid = evaluateToolCall(call, expected) ? 1 : 0;
        evaluated++;
        if (isValid) valid++;
      }
    }

    await db.insert(toolCallsLog).values({
      runResultId,
      toolName: call.name,
      arguments: JSON.stringify(call.arguments),
      result: call.result || null,
      expectedResult: expectedTools?.find((e: any) => e.name === call.name)?.expectedArgs ? JSON.stringify(expectedTools.find((e: any) => e.name === call.name)) : null,
      isValid,
    });
  }

  // Update run result with tool calls JSON
  await db.update(runResults).set({ toolCallsJson: JSON.stringify(parsed) }).where(eq(runResults.id, runResultId));

  return NextResponse.json({ parsed, evaluated, valid });
}
