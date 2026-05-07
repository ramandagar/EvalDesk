import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateApiKey } from "@/lib/api-keys";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    projectId: apiKeys.projectId,
    permissions: apiKeys.permissions,
    lastUsedAt: apiKeys.lastUsedAt,
    expiresAt: apiKeys.expiresAt,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(eq(apiKeys.userId, user.id));

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, projectId, permissions } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { key, hash, prefix } = generateApiKey();

  await db.insert(apiKeys).values({
    userId: user.id,
    projectId: projectId || null,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions: JSON.stringify(permissions || ["read"]),
  });

  // Return full key ONLY on creation — never again
  return NextResponse.json({ name, key, prefix, permissions: permissions || ["read"] });
}
