import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendSlackNotification } from "@/lib/slack-notifier";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Configure Slack
  if (body.action === "configure") {
    const { projectId, webhookUrl, channel, notifyOn } = body;
    if (!projectId || !webhookUrl) return NextResponse.json({ error: "projectId and webhookUrl required" }, { status: 400 });

    await db.update(projects).set({
      slackWebhookUrl: webhookUrl,
      slackChannel: channel || "",
      slackNotifyOn: JSON.stringify(notifyOn || ["regression"]),
    }).where(eq(projects.id, projectId));

    return NextResponse.json({ success: true });
  }

  // Test Slack notification
  if (body.action === "test") {
    const { webhookUrl } = body;
    if (!webhookUrl) return NextResponse.json({ error: "webhookUrl required" }, { status: 400 });

    const sent = await sendSlackNotification(webhookUrl, {
      title: "EvalDesk Test Notification",
      type: "success",
      projectName: "Test Project",
      passRate: 100,
    });

    return NextResponse.json({ success: sent });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
