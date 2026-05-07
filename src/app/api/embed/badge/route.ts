import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runs, projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateBadgeSVG } from "@/lib/embed-badge";

// GET /api/embed/badge?projectId=xxx&style=flat
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Get latest completed run
    const [latestRun] = await db
      .select()
      .from(runs)
      .where(eq(runs.projectId, projectId))
      .orderBy(desc(runs.createdAt))
      .limit(1);

    const passRate = latestRun?.passRate ?? null;
    const svg = generateBadgeSVG(passRate, project.name);

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
