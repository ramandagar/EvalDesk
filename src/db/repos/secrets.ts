import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Stores only AES-256-GCM ciphertext blobs (see lib/crypto/secrets). Keyed by
// (org_id, ref_type, ref_id, name) so e.g. a project's agent API key lives at
// ("project", projectId, "agent_api_key"). Org-scoped like every repo.
export function secretsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.secrets;

  const match = (orgId: string, refType: string, refId: string, name: string) =>
    and(eq(t.orgId, orgId), eq(t.refType, refType), eq(t.refId, refId), eq(t.name, name));

  return {
    async put(input: {
      orgId: string;
      refType: string;
      refId: string;
      name: string;
      ciphertext: string;
      now: number;
    }): Promise<void> {
      const existing = await db
        .select()
        .from(t)
        .where(match(input.orgId, input.refType, input.refId, input.name));
      if (existing.length) {
        await db
          .update(t)
          .set({ ciphertext: input.ciphertext, updatedAt: input.now })
          .where(match(input.orgId, input.refType, input.refId, input.name));
      } else {
        await db.insert(t).values({
          orgId: input.orgId,
          refType: input.refType,
          refId: input.refId,
          name: input.name,
          ciphertext: input.ciphertext,
          createdAt: input.now,
          updatedAt: input.now,
        });
      }
    },

    async get(
      orgId: string,
      refType: string,
      refId: string,
      name: string,
    ): Promise<string | null> {
      const [row] = await db.select().from(t).where(match(orgId, refType, refId, name));
      return row ? (row.ciphertext as string) : null;
    },
  };
}
