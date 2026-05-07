import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { exportGoldenSet, validateGoldenSet, type GoldenSetExport, type GoldenSetValidation } from "@/lib/golden-set";

/**
 * GET /api/test-cases/golden?projectId=...&action=list|export|validate
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const action = req.nextUrl.searchParams.get("action") || "list";

    if (action === "export") {
      const exported: GoldenSetExport = await exportGoldenSet(projectId);
      return NextResponse.json(exported);
    }

    if (action === "validate") {
      const validation: GoldenSetValidation = await validateGoldenSet(projectId);
      return NextResponse.json(validation);
    }

    // Default: list golden cases
    const cases = await db
      .select()
      .from(testCases)
      .where(and(eq(testCases.projectId, projectId), eq(testCases.goldenSet, true)));

    return NextResponse.json({ cases, total: cases.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch golden set" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test-cases/golden
 * Body: { projectId, action: "mark"|"unmark", caseIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const body = await req.json();
    const { projectId, action, caseIds } = body;

    if (!projectId || !action || !Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json(
        { error: "projectId, action (mark|unmark), and caseIds[] required" },
        { status: 400 }
      );
    }

    if (action === "mark") {
      const updated = await db
        .update(testCases)
        .set({ goldenSet: true, updatedAt: new Date() })
        .where(and(eq(testCases.projectId, projectId), inArray(testCases.id, caseIds)))
        .returning();

      return NextResponse.json({
        success: true,
        action: "mark",
        updatedCount: updated.length,
        cases: updated,
      });
    }

    if (action === "unmark") {
      const updated = await db
        .update(testCases)
        .set({ goldenSet: false, updatedAt: new Date() })
        .where(and(eq(testCases.projectId, projectId), inArray(testCases.id, caseIds)))
        .returning();

      return NextResponse.json({
        success: true,
        action: "unmark",
        updatedCount: updated.length,
        cases: updated,
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'mark' or 'unmark'." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Golden set operation failed" },
      { status: 500 }
    );
  }
}
