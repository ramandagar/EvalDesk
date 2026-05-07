import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { mineProductionLogs, parseProductionLogs } from "@/lib/production-miner";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const body = await req.json();
    const { projectId, logs, rawLogs, options } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Accept either pre-parsed logs array or raw JSON string
    let parsedLogs;
    if (logs && Array.isArray(logs)) {
      parsedLogs = logs;
    } else if (rawLogs && typeof rawLogs === "string") {
      parsedLogs = parseProductionLogs(rawLogs);
    } else {
      return NextResponse.json(
        { error: "Provide 'logs' (JSON array) or 'rawLogs' (JSON string) of production conversation logs." },
        { status: 400 }
      );
    }

    if (parsedLogs.length === 0) {
      return NextResponse.json({ error: "No log entries provided." }, { status: 400 });
    }

    const miningOptions = {
      onlyHelpful: options?.onlyHelpful ?? false,
      minInputLength: options?.minInputLength ?? 5,
      minOutputLength: options?.minOutputLength ?? 10,
      maxCases: options?.maxCases ?? undefined,
      extraTags: options?.extraTags ?? [],
    };

    const result = mineProductionLogs(parsedLogs, miningOptions);

    if (result.cases.length === 0) {
      return NextResponse.json({
        success: true,
        mined: 0,
        totalLogs: result.totalLogs,
        skippedEmpty: result.skippedEmpty,
        skippedUnhelpful: result.skippedUnhelpful,
        message: "No valid test cases could be mined from the provided logs.",
      });
    }

    // Insert mined cases into database
    const values = result.cases.map((c) => ({
      projectId,
      title: c.title,
      input: c.input,
      expectedOutput: c.expectedOutput || null,
      category: c.category,
      tags: c.tags,
      difficulty: c.difficulty,
      source: "production" as const,
    }));

    const inserted = await db.insert(testCases).values(values).returning();

    return NextResponse.json({
      success: true,
      mined: inserted.length,
      totalLogs: result.totalLogs,
      skippedEmpty: result.skippedEmpty,
      skippedUnhelpful: result.skippedUnhelpful,
      cases: inserted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Production mining failed" },
      { status: 500 }
    );
  }
}
