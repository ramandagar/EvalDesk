import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { checkCitations } from "@/lib/citation-checker";
import { db } from "@/db";
import { citationChecks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const runResultId = url.searchParams.get("runResultId");
  if (!runResultId) return NextResponse.json({ error: "runResultId required" }, { status: 400 });

  const checks = await db.select().from(citationChecks).where(eq(citationChecks.runResultId, runResultId));
  return NextResponse.json(checks);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { runResultId, apiKey } = body;
    if (!runResultId) return NextResponse.json({ error: "runResultId required" }, { status: 400 });

    const result = await checkCitations(runResultId, apiKey);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
