import { and, eq, isNull, desc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Ed25519 signing keys. A null org_id is the per-instance key (self-host); a set
// org_id is a per-tenant key (cloud). The private key lives encrypted in
// `secrets` (referenced by private_key_secret_id); only the public key is here.

export interface SigningKey {
  id: string;
  orgId: string | null;
  publicKeyPem: string;
  privateKeySecretId: string | null;
  algo: string;
  createdAt: number;
  retiredAt: number | null;
}

export function signingKeysRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.signingKeys;

  return {
    async create(input: {
      orgId: string | null;
      publicKeyPem: string;
      now: number;
      privateKeySecretId?: string | null;
      algo?: string;
      id?: string;
    }): Promise<SigningKey> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId: input.orgId,
          publicKeyPem: input.publicKeyPem,
          privateKeySecretId: input.privateKeySecretId ?? null,
          algo: input.algo ?? "ed25519",
          createdAt: input.now,
          retiredAt: null,
        })
        .returning();
      return row as SigningKey;
    },

    /** Latest non-retired key for an org (or the instance key when orgId is null). */
    async getActive(orgId: string | null): Promise<SigningKey | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(orgId === null ? isNull(t.orgId) : eq(t.orgId, orgId), isNull(t.retiredAt)))
        .orderBy(desc(t.createdAt))
        .limit(1);
      return (row as SigningKey) ?? null;
    },

    async getById(id: string): Promise<SigningKey | null> {
      const [row] = await db.select().from(t).where(eq(t.id, id));
      return (row as SigningKey) ?? null;
    },
  };
}
