import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, cases } = body;

    if (!projectId || !Array.isArray(cases) || cases.length === 0) {
      return NextResponse.json({ error: "projectId and cases[] required" }, { status: 400 });
    }

    const values = cases.map((c: any) => ({
      projectId,
      title: c.title || c.input.slice(0, 80),
      input: c.input,
      expectedOutput: c.expectedOutput || null,
      category: c.category || null,
    }));

    const inserted = await db.insert(testCases).values(values).returning();

    return NextResponse.json({ count: inserted.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to import" }, { status: 500 });
  }
}
