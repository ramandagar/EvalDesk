import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, testCases, runs } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-utils";

export async function GET() {
  const user = await requireAuth(new NextRequest("http://localhost"));
  if (!user) {
    // For demo/unseeded: return empty instead of error so dashboard doesn't crash
    try {
      const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(50);
      const enriched = await Promise.all(allProjects.map(async (p) => {
        try {
          const [tc] = await db.select({ count: sql<number>`count(*)` }).from(testCases).where(eq(testCases.projectId, p.id));
          const [rc] = await db.select({ count: sql<number>`count(*)` }).from(runs).where(eq(runs.projectId, p.id));
          const lastRun = await db.select({ passRate: runs.passRate }).from(runs).where(eq(runs.projectId, p.id)).orderBy(desc(runs.createdAt)).limit(1);
          return { ...p, testCaseCount: tc?.count ?? 0, runCount: rc?.count ?? 0, lastPassRate: lastRun[0]?.passRate ?? null };
        } catch { return { ...p, testCaseCount: 0, runCount: 0, lastPassRate: null }; }
      }));
      return NextResponse.json(enriched);
    } catch { return NextResponse.json([]); }
  }

  try {
    const myProjects = await db.select().from(projects).where(eq(projects.userId, user.id)).orderBy(desc(projects.createdAt));
    const enriched = await Promise.all(myProjects.map(async (p) => {
      const [tc] = await db.select({ count: sql<number>`count(*)` }).from(testCases).where(eq(testCases.projectId, p.id));
      const [rc] = await db.select({ count: sql<number>`count(*)` }).from(runs).where(eq(runs.projectId, p.id));
      const lastRun = await db.select({ passRate: runs.passRate }).from(runs).where(eq(runs.projectId, p.id)).orderBy(desc(runs.createdAt)).limit(1);
      return { ...p, testCaseCount: tc?.count ?? 0, runCount: rc?.count ?? 0, lastPassRate: lastRun[0]?.passRate ?? null };
    }));
    return NextResponse.json(enriched);
  } catch { return NextResponse.json([]); }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, endpoint, apiKey, agentType, agentConfig } = body;
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const projRows = await db.insert(projects).values({
      name,
      description: description || null,
      agentEndpoint: endpoint || null,
      agentApiKey: apiKey || null,
      agentHeaders: agentConfig ? JSON.stringify(agentConfig) : (agentType ? JSON.stringify({ type: agentType }) : null),
      userId: user.id,
    }).returning();

    return NextResponse.json((projRows as any[])[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create project" }, { status: 500 });
  }
}
