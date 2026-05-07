import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { conversationMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { role, content } = body;
  if (!role || !content) return NextResponse.json({ error: "role and content required" }, { status: 400 });

  // Get current max order
  const existing = await db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, id));
  const nextOrder = existing.length;

  const [msg] = await db.insert(conversationMessages).values({
    conversationId: id,
    role,
    content,
    order: nextOrder,
  }).returning();

  return NextResponse.json(msg);
}
