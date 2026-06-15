import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

export type Role = "owner" | "admin" | "reviewer" | "viewer";

export interface Membership {
  id: string;
  orgId: string;
  userId: string;
  role: Role;
  invitedBy: string | null;
  invitedAt: number | null;
  acceptedAt: number | null;
  createdAt: number;
}

export interface CreateMembershipInput {
  orgId: string;
  userId: string;
  role: Role;
  now: number;
  invitedBy?: string | null;
  invitedAt?: number | null;
  acceptedAt?: number | null;
  id?: string;
}

export function membershipsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.memberships;

  return {
    async create(input: CreateMembershipInput): Promise<Membership> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId: input.orgId,
          userId: input.userId,
          role: input.role,
          invitedBy: input.invitedBy ?? null,
          invitedAt: input.invitedAt ?? null,
          acceptedAt: input.acceptedAt ?? null,
          createdAt: input.now,
        })
        .returning();
      return row as Membership;
    },

    /** The membership of a user within an org — the core authorization lookup. */
    async get(orgId: string, userId: string): Promise<Membership | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.userId, userId)));
      return (row as Membership) ?? null;
    },

    async listForUser(userId: string): Promise<Membership[]> {
      const rows = await db.select().from(t).where(eq(t.userId, userId));
      return rows as Membership[];
    },

    async listForOrg(orgId: string): Promise<Membership[]> {
      const rows = await db.select().from(t).where(eq(t.orgId, orgId));
      return rows as Membership[];
    },

    async updateRole(orgId: string, userId: string, role: Role): Promise<Membership | null> {
      const [row] = await db
        .update(t)
        .set({ role })
        .where(and(eq(t.orgId, orgId), eq(t.userId, userId)))
        .returning();
      return (row as Membership) ?? null;
    },

    async remove(orgId: string, userId: string): Promise<boolean> {
      const rows = await db
        .delete(t)
        .where(and(eq(t.orgId, orgId), eq(t.userId, userId)))
        .returning();
      return rows.length > 0;
    },
  };
}
