import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [hook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const payload = JSON.stringify({
      event: "test",
      data: { message: "EvalDesk webhook test", timestamp: new Date().toISOString() },
    });

    const res = await fetch(hook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    return NextResponse.json({ success: res.ok, statusCode: res.status });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
