import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function dispatchWebhook(projectId: string, event: string, data: any) {
  const hooks = await db.select().from(webhooks).where(eq(webhooks.projectId, projectId));
  const activeHooks = hooks.filter(h => h.isActive && JSON.parse(h.events || "[]").includes(event));

  for (const hook of activeHooks) {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    let success = false;
    let statusCode = 0;
    let responseBody = "";

    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(hook.secret ? { "X-EvalDesk-Signature": hook.secret } : {}) },
        body: payload,
        signal: AbortSignal.timeout(10000),
      });
      statusCode = res.status;
      responseBody = await res.text().catch(() => "");
      success = res.status >= 200 && res.status < 300;
    } catch (e: any) {
      success = false;
      responseBody = e.message;
    }

    // Retry once on failure
    if (!success) {
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(hook.secret ? { "X-EvalDesk-Signature": hook.secret } : {}) },
          body: payload,
          signal: AbortSignal.timeout(10000),
        });
        statusCode = res.status;
        success = res.status >= 200 && res.status < 300;
      } catch { /* retry failed */ }
    }

    await db.insert(webhookDeliveries).values({
      webhookId: hook.id,
      event,
      payload,
      statusCode,
      responseBody: responseBody.slice(0, 1000),
      success: success ? 1 : 0,
      attempts: 2,
    });

    // Update last triggered
    await db.update(webhooks).set({ lastTriggered: new Date() }).where(eq(webhooks.id, hook.id));
  }
}
