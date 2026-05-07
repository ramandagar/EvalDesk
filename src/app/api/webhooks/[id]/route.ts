import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [hook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deliveries = await db.select().from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(20);

  return NextResponse.json({ ...hook, deliveries });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db.update(webhooks).set({
    ...(body.url && { url: body.url }),
    ...(body.events && { events: JSON.stringify(body.events) }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
  }).where(eq(webhooks.id, id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(webhooks).where(eq(webhooks.id, id));
  return NextResponse.json({ success: true });
}
