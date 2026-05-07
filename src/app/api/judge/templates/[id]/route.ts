import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { judgeTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db.update(judgeTemplates).set({
    ...body,
  }).where(eq(judgeTemplates.id, id)).returning();

  if (!updated) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(judgeTemplates).where(eq(judgeTemplates.id, id));
  return NextResponse.json({ success: true });
}
