import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const action = url.searchParams.get("action");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const conditions = [];
  if (projectId) conditions.push(eq(auditLog.projectId, projectId));
  if (action) conditions.push(eq(auditLog.action, action));

  const logs = conditions.length > 0
    ? await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(limit)
    : await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);

  return NextResponse.json(logs);
}
