import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeRun } from "@/lib/agent-runner";
import { requireAuth } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(req);
  if (error || !user) return error || NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const { projectId, runName } = body;
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.agentEndpoint) return NextResponse.json({ error: "No agent endpoint configured. Go to project settings to add one." }, { status: 400 });

    const result = await executeRun({
      projectId,
      endpoint: project.agentEndpoint,
      apiKey: project.agentApiKey || undefined,
      method: project.agentMethod || undefined,
      headers: project.agentHeaders,
      runName: runName || undefined,
      triggeredBy: user.id,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to execute run" }, { status: 500 });
  }
}
