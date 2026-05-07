import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return NextResponse.json({ success: true });
}
