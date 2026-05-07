import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const hooks = await db.select().from(webhooks).where(eq(webhooks.projectId, projectId));
  return NextResponse.json(hooks);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, url, events, secret } = body;
  if (!projectId || !url || !events) return NextResponse.json({ error: "projectId, url, events required" }, { status: 400 });

  const [hook] = await db.insert(webhooks).values({
    projectId,
    url,
    events: JSON.stringify(events),
    secret,
  }).returning();

  return NextResponse.json(hook);
}
