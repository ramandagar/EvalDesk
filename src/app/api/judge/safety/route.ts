import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { scoreSafety } from "@/lib/safety-scorer";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { runResultId, apiKey } = body;
    if (!runResultId) return NextResponse.json({ error: "runResultId required" }, { status: 400 });

    const result = await scoreSafety(runResultId, apiKey);
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e.message?.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
