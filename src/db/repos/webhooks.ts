import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Registered webhook endpoints. The signing secret is stored ONLY as an
// AES-GCM ciphertext (decrypted by the worker just before delivery). `events`
// is the list of event names this endpoint subscribes to. Org-scoped.

export interface Webhook {
  id: string;
  orgId: string;
  projectId: string | null;
  url: string;
  secretCiphertext: string;
  events: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: number;
}

export function webhooksRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.webhooks;

  return {
    async create(
      orgId: string,
      input: { url: string; secretCiphertext: string; events: string[]; now: number; projectId?: string | null; createdBy?: string | null; id?: string },
    ): Promise<Webhook> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          projectId: input.projectId ?? null,
          url: input.url,
          secretCiphertext: input.secretCiphertext,
          events: input.events,
          isActive: true,
          createdBy: input.createdBy ?? null,
          createdAt: input.now,
        })
        .returning();
      return row as Webhook;
    },

    async getInOrg(orgId: string, id: string): Promise<Webhook | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as Webhook) ?? null;
    },

    async listForOrg(orgId: string): Promise<Webhook[]> {
      const rows = await db.select().from(t).where(eq(t.orgId, orgId)).orderBy(t.createdAt);
      return rows as Webhook[];
    },

    /** Active webhooks in an org subscribed to a given event. */
    async listSubscribed(orgId: string, event: string): Promise<Webhook[]> {
      const rows = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.isActive, true)));
      return (rows as Webhook[]).filter((w) => w.events.includes(event));
    },
  };
}
