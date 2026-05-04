import { NextRequest, NextResponse } from "next/server";
import { llmJudge } from "@/lib/judge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runResultId, model, apiKey } = body;

    if (!runResultId) {
      return NextResponse.json({ error: "runResultId required" }, { status: 400 });
    }

    const result = await llmJudge({ runResultId, model, apiKey });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Judge failed" },
      { status: 500 }
    );
  }
}
