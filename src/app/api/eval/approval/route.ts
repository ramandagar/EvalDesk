import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { runs, auditLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@/lib/utils";

// GET /api/eval/approval?runId=xxx — Get approval status for a run
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runId = request.nextUrl.searchParams.get("runId");
  const projectId = request.nextUrl.searchParams.get("projectId");

  try {
    if (runId) {
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));
      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }

      // Fetch approval-related audit entries for this run
      const approvalLogs = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.resourceId, runId))
        .orderBy(desc(auditLog.createdAt));

      const approvalActions = approvalLogs.filter(
        (l) => l.action === "run.approved" || l.action === "run.rejected"
      );

      return NextResponse.json({
        runId: run.id,
        approvalStatus: run.approvalStatus || "pending",
        approvedBy: run.approvedBy,
        approvedAt: run.approvedAt,
        history: approvalActions.map((l) => ({
          action: l.action,
          userId: l.userId,
          details: l.details ? JSON.parse(l.details) : null,
          createdAt: l.createdAt,
        })),
      });
    }

    if (projectId) {
      // List all runs with approval status for this project
      const projectRuns = await db
        .select({
          id: runs.id,
          name: runs.name,
          status: runs.status,
          passRate: runs.passRate,
          approvalStatus: runs.approvalStatus,
          approvedBy: runs.approvedBy,
          approvedAt: runs.approvedAt,
          createdAt: runs.createdAt,
        })
        .from(runs)
        .where(eq(runs.projectId, projectId))
        .orderBy(desc(runs.createdAt));

      return NextResponse.json({ runs: projectRuns });
    }

    return NextResponse.json(
      { error: "runId or projectId required" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch approval status" },
      { status: 500 }
    );
  }
}

// POST /api/eval/approval — Approve or reject a run
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { runId, action, comment } = body;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }
    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const approvalStatus = action === "approve" ? "approved" : "rejected";
    const auditAction = action === "approve" ? "run.approved" : "run.rejected";

    // Update run approval fields
    await db
      .update(runs)
      .set({
        approvalStatus,
        approvedBy: user.id,
        approvedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    // Log to audit trail
    await db.insert(auditLog).values({
      id: createId(),
      userId: user.id,
      projectId: run.projectId,
      action: auditAction,
      resourceType: "run",
      resourceId: runId,
      details: JSON.stringify({
        comment: comment || null,
        approvalStatus,
        previousStatus: run.approvalStatus || "pending",
      }),
    });

    return NextResponse.json({
      runId,
      approvalStatus,
      approvedBy: user.id,
      approvedAt: new Date(),
      message: `Run ${action === "approve" ? "approved" : "rejected"} successfully`,
    });
  } catch (error: any) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: error.message || "Approval action failed" },
      { status: 500 }
    );
  }
}
