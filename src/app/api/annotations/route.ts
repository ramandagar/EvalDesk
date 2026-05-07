import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { annotationQueues, runResults } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const conditions = [eq(annotationQueues.projectId, projectId)];
  if (status) conditions.push(eq(annotationQueues.status, status));

  const queue = await db.select().from(annotationQueues).where(and(...conditions));
  return NextResponse.json(queue);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, runResultIds, assignedTo, priority, dueAt } = body;
  if (!projectId || !runResultIds?.length) return NextResponse.json({ error: "projectId and runResultIds required" }, { status: 400 });

  let assigned = 0;
  for (const resultId of runResultIds) {
    await db.insert(annotationQueues).values({
      projectId,
      runResultId: resultId,
      assignedTo: assignedTo || null,
      priority: priority || "normal",
      dueAt: dueAt ? new Date(dueAt) : null,
    });
    assigned++;
  }

  return NextResponse.json({ assigned });
}
