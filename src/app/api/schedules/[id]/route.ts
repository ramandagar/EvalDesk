import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db.update(scheduledRuns).set({
    ...(body.cronExpression && { cronExpression: body.cronExpression }),
    ...(body.runNameTemplate && { runNameTemplate: body.runNameTemplate }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
  }).where(eq(scheduledRuns.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(scheduledRuns).where(eq(scheduledRuns.id, id));
  return NextResponse.json({ success: true });
}
