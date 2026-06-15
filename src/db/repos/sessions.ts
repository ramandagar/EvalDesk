import { and, eq, isNull } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

export interface Session {
  id: string;
  userId: string;
  orgId: string | null;
  tokenHash: string;
  ip: string | null;
  userAgent: string | null;
  lastSeenAt: number | null;
  revokedAt: number | null;
  expiresAt: number;
  createdAt: number;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: number;
  now: number;
  orgId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  id?: string;
}

export function sessionsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.sessions;

  return {
    async create(input: CreateSessionInput): Promise<Session> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          userId: input.userId,
          orgId: input.orgId ?? null,
          tokenHash: input.tokenHash,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          expiresAt: input.expiresAt,
          createdAt: input.now,
        })
        .returning();
      return row as Session;
    },

    /** Raw fetch by token hash. Validity (expiry/revocation) is the service's job. */
    async getByTokenHash(tokenHash: string): Promise<Session | null> {
      const [row] = await db.select().from(t).where(eq(t.tokenHash, tokenHash));
      return (row as Session) ?? null;
    },

    async revoke(id: string, now: number): Promise<void> {
      await db.update(t).set({ revokedAt: now }).where(eq(t.id, id));
    },

    /** Revoke every live session for a user (e.g. after a password reset). */
    async revokeAllForUser(userId: string, now: number): Promise<void> {
      await db.update(t).set({ revokedAt: now }).where(and(eq(t.userId, userId), isNull(t.revokedAt)));
    },

    async setActiveOrg(id: string, orgId: string): Promise<void> {
      await db.update(t).set({ orgId }).where(eq(t.id, id));
    },

    async touch(id: string, now: number): Promise<void> {
      await db.update(t).set({ lastSeenAt: now }).where(eq(t.id, id));
    },
  };
}
