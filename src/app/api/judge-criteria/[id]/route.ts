import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { judgeCriteria } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const updates: any = {};
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.criteria) updates.criteria = body.criteria;
    if (body.passThreshold) updates.passThreshold = body.passThreshold;
    if (body.model) updates.model = body.model;
    updates.updatedAt = new Date();

    const rows = await db
      .update(judgeCriteria)
      .set(updates)
      .where(eq(judgeCriteria.id, id))
      .returning();

    const updated = (rows as any[])[0];
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { id } = await params;
  await db.delete(judgeCriteria).where(eq(judgeCriteria.id, id));
  return NextResponse.json({ success: true });
}
