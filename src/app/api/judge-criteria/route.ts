import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { judgeCriteria } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const criteria = await db
    .select()
    .from(judgeCriteria)
    .where(eq(judgeCriteria.projectId, projectId));

  return NextResponse.json(criteria);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { projectId, name, description, criteria, passThreshold, model } = body;

    if (!projectId || !name || !criteria) {
      return NextResponse.json({ error: "projectId, name, and criteria required" }, { status: 400 });
    }

    const rows = await db
      .insert(judgeCriteria)
      .values({
        projectId,
        name,
        description: description || null,
        criteria,
        passThreshold: passThreshold || 70,
        model: model || "gpt-4o-mini",
      })
      .returning();

    return NextResponse.json((rows as any[])[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create" }, { status: 500 });
  }
}
