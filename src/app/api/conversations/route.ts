import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { conversations, conversationMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const convos = await db.select().from(conversations)
    .where(eq(conversations.projectId, projectId))
    .orderBy(desc(conversations.createdAt));

  return NextResponse.json(convos);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, title, messages } = body;
  if (!projectId || !title) return NextResponse.json({ error: "projectId and title required" }, { status: 400 });

  const [convo] = await db.insert(conversations).values({ projectId, title }).returning();

  if (messages && Array.isArray(messages)) {
    for (let i = 0; i < messages.length; i++) {
      await db.insert(conversationMessages).values({
        conversationId: convo.id,
        role: messages[i].role || "user",
        content: messages[i].content,
        order: i,
      });
    }
  }

  const savedMessages = await db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, convo.id));
  return NextResponse.json({ ...convo, messages: savedMessages });
}
