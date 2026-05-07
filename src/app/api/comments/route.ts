import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const runResultId = url.searchParams.get("runResultId");
  const projectId = url.searchParams.get("projectId");

  if (runResultId) {
    const result = await db.select().from(comments).where(eq(comments.runResultId, runResultId)).orderBy(desc(comments.createdAt));
    return NextResponse.json(result);
  }
  if (projectId) {
    const result = await db.select().from(comments).where(eq(comments.projectId, projectId)).orderBy(desc(comments.createdAt));
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "runResultId or projectId required" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { runResultId, projectId, body: commentBody, parentId } = body;
  if (!projectId || !commentBody) return NextResponse.json({ error: "projectId and body required" }, { status: 400 });

  const rows = await db.insert(comments).values({
    runResultId: runResultId || null,
    projectId,
    parentId: parentId || null,
    userId: user.id,
    body: commentBody,
  }).returning();

  return NextResponse.json(Array.isArray(rows) ? rows[0] : rows);
}
