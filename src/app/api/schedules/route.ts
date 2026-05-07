import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const schedules = await db.select().from(scheduledRuns).where(eq(scheduledRuns.projectId, projectId));
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, cronExpression, runNameTemplate } = body;
  if (!projectId || !cronExpression) return NextResponse.json({ error: "projectId and cronExpression required" }, { status: 400 });

  // Parse simple intervals: "every Nh", "every Nd", "every Nw"
  const nextRunAt = computeNextRun(cronExpression);

  const [schedule] = await db.insert(scheduledRuns).values({
    projectId,
    cronExpression,
    runNameTemplate,
    createdBy: user.id,
    nextRunAt,
  }).returning();

  return NextResponse.json(schedule);
}

function computeNextRun(expression: string): Date {
  const match = expression.match(/every\s+(\d+)\s*(m|h|d|w)/i);
  if (!match) return new Date(Date.now() + 24 * 60 * 60 * 1000); // default 24h

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const ms: Record<string, number> = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return new Date(Date.now() + amount * (ms[unit] || 86400000));
}
