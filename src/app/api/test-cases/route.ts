import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  try {
    const cases = await db
      .select()
      .from(testCases)
      .where(eq(testCases.projectId, projectId))
      .orderBy(testCases.order, desc(testCases.createdAt));

    return NextResponse.json(cases);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch test cases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, title, input, expectedOutput, category } = body;

    if (!projectId || !input) {
      return NextResponse.json({ error: "projectId and input required" }, { status: 400 });
    }

    const [tc] = await db
      .insert(testCases)
      .values({
        projectId,
        title: title || input.slice(0, 80),
        input,
        expectedOutput: expectedOutput || null,
        category: category || null,
      })
      .returning();

    return NextResponse.json(tc);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create test case" }, { status: 500 });
  }
}
