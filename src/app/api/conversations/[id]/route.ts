import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { conversations, conversationMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [convo] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.select().from(conversationMessages)
    .where(eq(conversationMessages.conversationId, id))
    .orderBy(conversationMessages.order);

  return NextResponse.json({ ...convo, messages });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db.update(conversations).set({ title: body.title, updatedAt: new Date() })
    .where(eq(conversations.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(conversations).where(eq(conversations.id, id));
  return NextResponse.json({ success: true });
}
