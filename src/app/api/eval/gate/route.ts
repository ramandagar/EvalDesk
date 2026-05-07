import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { runs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkGate } from "@/lib/regression-gate";

// GET /api/eval/gate?runId=xxx — Check if a run passes its gate
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  try {
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const threshold = run.passThreshold ?? 80;
    const result = checkGate({
      passRate: run.passRate,
      threshold,
      totalCases: run.totalCases,
      passCount: run.passCount,
      failCount: run.failCount,
      partialCount: run.partialCount,
    });

    // Update run gating status
    await db
      .update(runs)
      .set({ isGated: result.status === "passed" })
      .where(eq(runs.id, runId));

    return NextResponse.json({
      runId,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gate check failed" },
      { status: 500 }
    );
  }
}

// POST /api/eval/gate — Evaluate a run against a threshold
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { runId, threshold } = body;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const effectiveThreshold = threshold ?? run.passThreshold ?? 80;

    const result = checkGate({
      passRate: run.passRate,
      threshold: effectiveThreshold,
      totalCases: run.totalCases,
      passCount: run.passCount,
      failCount: run.failCount,
      partialCount: run.partialCount,
    });

    // Update run with threshold and gating status
    await db
      .update(runs)
      .set({
        passThreshold: effectiveThreshold,
        isGated: result.status === "passed",
      })
      .where(eq(runs.id, runId));

    return NextResponse.json({
      runId,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gate check failed" },
      { status: 500 }
    );
  }
}
