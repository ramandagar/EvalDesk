import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, testCases, runs, runResults } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [tc] = await db
      .select({ count: sql<number>`count(*)` })
      .from(testCases)
      .where(eq(testCases.projectId, id));
    const [rc] = await db
      .select({ count: sql<number>`count(*)` })
      .from(runs)
      .where(eq(runs.projectId, id));
    const lastRun = await db
      .select({ passRate: runs.passRate })
      .from(runs)
      .where(eq(runs.projectId, id))
      .orderBy(desc(runs.createdAt))
      .limit(1);
    const recentRuns = await db
      .select()
      .from(runs)
      .where(eq(runs.projectId, id))
      .orderBy(desc(runs.createdAt))
      .limit(5);

    return NextResponse.json({
      ...project,
      testCaseCount: tc.count,
      runCount: rc.count,
      lastPassRate: lastRun[0]?.passRate ?? null,
      recentRuns,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, any> = {};
    const allowedFields = ["name", "description", "agentEndpoint", "agentApiKey", "agentMethod", "agentHeaders"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    updates.updatedAt = new Date();
    await db.update(projects).set(updates).where(eq(projects.id, id));
    const [updated] = await db.select().from(projects).where(eq(projects.id, id));
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
