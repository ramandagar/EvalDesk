import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Single-use, expiring password-reset tokens. Only the SHA-256 hash is stored.
export interface ResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  usedAt: number | null;
  createdAt: number;
}

export function passwordResetTokensRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.passwordResetTokens;

  return {
    async create(input: { userId: string; tokenHash: string; expiresAt: number; now: number }): Promise<ResetToken> {
      const [row] = await db
        .insert(t)
        .values({ userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt, usedAt: null, createdAt: input.now })
        .returning();
      return row as ResetToken;
    },

    /** Resolve a token by hash; null if unknown, used, or expired. */
    async resolve(tokenHash: string, now: number): Promise<ResetToken | null> {
      const [row] = await db.select().from(t).where(eq(t.tokenHash, tokenHash));
      const tok = (row as ResetToken) ?? null;
      if (!tok || tok.usedAt != null || tok.expiresAt < now) return null;
      return tok;
    },

    async markUsed(id: string, now: number): Promise<void> {
      await db.update(t).set({ usedAt: now }).where(and(eq(t.id, id)));
    },
  };
}
