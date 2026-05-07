import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { annotationQueues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db.update(annotationQueues).set({
    ...(body.status && { status: body.status }),
    ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
    ...(body.priority && { priority: body.priority }),
  }).where(eq(annotationQueues.id, id)).returning();

  return NextResponse.json(updated);
}
