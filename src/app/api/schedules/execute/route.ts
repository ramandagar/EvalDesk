import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { scheduledRuns, runs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/utils";

// POST /api/schedules/execute — Trigger all due scheduled runs
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();

    // Find all active schedules that are due
    const allSchedules = await db.select().from(scheduledRuns);
    const due = allSchedules.filter(s => s.isActive);

    const triggered: string[] = [];

    for (const schedule of due) {
      // Check if schedule is due (nextRunAt <= now or never run)
      if (schedule.nextRunAt && schedule.nextRunAt <= now) {
        const runId = createId();
        await db.insert(runs).values({
          id: runId,
          projectId: schedule.projectId,
          name: schedule.runNameTemplate || `Scheduled run`,
          status: "running",
          triggerType: "scheduled",
          scheduledRunId: schedule.id,
          triggeredBy: schedule.createdBy,
        });

        // Update schedule timestamps
        await db
          .update(scheduledRuns)
          .set({
            lastRunAt: now,
            // Simple next run: add 24h (cron parsing can be added later)
            nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          })
          .where(eq(scheduledRuns.id, schedule.id));

        triggered.push(runId);
      }
    }

    return NextResponse.json({
      triggered,
      count: triggered.length,
      checkedSchedules: due.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute schedules" },
      { status: 500 }
    );
  }
}
