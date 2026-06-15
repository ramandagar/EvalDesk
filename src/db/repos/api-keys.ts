import { and, eq, isNull, desc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Machine API keys for the SDK / GitHub Action / programmatic API. Only the
// SHA-256 HASH of the key is stored (never the raw key). The org is resolved
// FROM the key row (the key is bound to one org), and scopes gate capabilities.
// Resolution rejects revoked or expired keys.

export interface ApiKey {
  id: string;
  orgId: string;
  projectId: string | null;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[] | null;
  createdBy: string | null;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
  createdAt: number;
}

export interface CreateApiKeyInput {
  name: string;
  keyHash: string;
  keyPrefix: string;
  now: number;
  scopes?: string[] | null;
  projectId?: string | null;
  createdBy?: string | null;
  expiresAt?: number | null;
  id?: string;
}

export function apiKeysRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.apiKeys;

  return {
    async create(orgId: string, input: CreateApiKeyInput): Promise<ApiKey> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          projectId: input.projectId ?? null,
          name: input.name,
          keyHash: input.keyHash,
          keyPrefix: input.keyPrefix,
          scopes: input.scopes ?? null,
          createdBy: input.createdBy ?? null,
          expiresAt: input.expiresAt ?? null,
          revokedAt: null,
          createdAt: input.now,
        })
        .returning();
      return row as ApiKey;
    },

    /** Resolve a RAW key (already hashed by the caller) → the key row, or null if
     *  unknown / revoked / expired. */
    async resolveByHash(keyHash: string, now: number): Promise<ApiKey | null> {
      const [row] = await db.select().from(t).where(eq(t.keyHash, keyHash));
      const key = (row as ApiKey) ?? null;
      if (!key) return null;
      if (key.revokedAt != null) return null;
      if (key.expiresAt != null && key.expiresAt < now) return null;
      return key;
    },

    async listForOrg(orgId: string): Promise<ApiKey[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), isNull(t.revokedAt)))
        .orderBy(desc(t.createdAt));
      return rows as ApiKey[];
    },

    async getInOrg(orgId: string, id: string): Promise<ApiKey | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as ApiKey) ?? null;
    },

    async revoke(orgId: string, id: string, now: number): Promise<boolean> {
      const rows = await db
        .update(t)
        .set({ revokedAt: now })
        .where(and(eq(t.orgId, orgId), eq(t.id, id), isNull(t.revokedAt)))
        .returning();
      return rows.length > 0;
    },
  };
}
