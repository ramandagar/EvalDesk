import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// One approval/rejection per reviewer per run (unique run_id+reviewer_id). The
// finalize-and-sign worker checks these against the signoff policy's quorum.

export interface RunSignoff {
  id: string;
  orgId: string;
  runId: string;
  reviewerId: string;
  decision: string; // approve | reject
  note: string | null;
  credentialSnapshot: unknown | null;
  createdAt: number;
}

export function runSignoffsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.runSignoffs;

  return {
    /** Record a reviewer's decision. Idempotent per (run, reviewer): the latest wins. */
    async submit(
      orgId: string,
      input: {
        runId: string;
        reviewerId: string;
        decision: string;
        now: number;
        note?: string | null;
        credentialSnapshot?: unknown | null;
        id?: string;
      },
    ): Promise<RunSignoff> {
      const existing = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.runId, input.runId), eq(t.reviewerId, input.reviewerId)));
      const values = {
        decision: input.decision,
        note: input.note ?? null,
        credentialSnapshot: input.credentialSnapshot ?? null,
        createdAt: input.now,
      };
      if (existing.length) {
        const [row] = await db
          .update(t)
          .set(values)
          .where(and(eq(t.orgId, orgId), eq(t.runId, input.runId), eq(t.reviewerId, input.reviewerId)))
          .returning();
        return row as RunSignoff;
      }
      const [row] = await db
        .insert(t)
        .values({ ...(input.id ? { id: input.id } : {}), orgId, runId: input.runId, reviewerId: input.reviewerId, ...values })
        .returning();
      return row as RunSignoff;
    },

    async listForRun(orgId: string, runId: string): Promise<RunSignoff[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.runId, runId)))
        .orderBy(t.createdAt);
      return rows as RunSignoff[];
    },
  };
}
