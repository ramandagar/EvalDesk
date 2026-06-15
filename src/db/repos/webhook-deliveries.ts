import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Append-only delivery attempt log. One row per (webhook, event) dispatch; the
// worker updates status/attempts/response as it retries.

export interface WebhookDelivery {
  id: string;
  orgId: string;
  webhookId: string;
  event: string;
  payload: unknown | null;
  status: string; // pending | delivered | failed
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export function webhookDeliveriesRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.webhookDeliveries;

  return {
    async create(orgId: string, input: { webhookId: string; event: string; payload?: unknown; now: number; id?: string }): Promise<WebhookDelivery> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          webhookId: input.webhookId,
          event: input.event,
          payload: input.payload ?? null,
          status: "pending",
          attempts: 0,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();
      return row as WebhookDelivery;
    },

    async update(
      orgId: string,
      id: string,
      patch: { status?: string; attempts?: number; responseStatus?: number | null; lastError?: string | null; updatedAt: number },
    ): Promise<WebhookDelivery | null> {
      const [row] = await db
        .update(t)
        .set(patch)
        .where(and(eq(t.orgId, orgId), eq(t.id, id)))
        .returning();
      return (row as WebhookDelivery) ?? null;
    },

    async getInOrg(orgId: string, id: string): Promise<WebhookDelivery | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as WebhookDelivery) ?? null;
    },

    async listForWebhook(orgId: string, webhookId: string): Promise<WebhookDelivery[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.webhookId, webhookId)))
        .orderBy(t.createdAt);
      return rows as WebhookDelivery[];
    },
  };
}
