import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runResults, runs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateRunStats } from "@/lib/agent-runner";
import { requireAuth } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const { user } = await requireAuth(req);
  const userId = user?.id || null;
  try {
    const body = await req.json();
    const { runResultId, rating, comment } = body;

    if (!runResultId || !rating) {
      return NextResponse.json({ error: "runResultId and rating required" }, { status: 400 });
    }

    if (!["pass", "fail", "partial"].includes(rating)) {
      return NextResponse.json({ error: "Rating must be pass, fail, or partial" }, { status: 400 });
    }

    const [result] = await db
      .update(runResults)
      .set({
        humanRating: rating,
        humanComment: comment || null,
        ratedBy: userId,
        ratedAt: new Date(),
      })
      .where(eq(runResults.id, runResultId))
      .returning();

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // Update run stats
    await updateRunStats(result.runId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Rating error:", error);
    return NextResponse.json({ error: error.message || "Failed to save rating" }, { status: 500 });
  }
}
