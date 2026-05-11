import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { runMultiJudge } from "@/lib/multi-judge";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { runResultId, models, apiKey, criteriaId } = body;
    if (!runResultId) return NextResponse.json({ error: "runResultId required" }, { status: 400 });

    const result = await runMultiJudge({ runResultId, models, apiKey, criteriaId });
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e.message?.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
