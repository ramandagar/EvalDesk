import { and, eq, inArray } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// The derived FINAL verdict per result (third layer). One row per result
// (unique run_result_id); recomputed by review.settled when a human verdict
// lands. `locked` is set when the run is finalized + signed; post-lock writes
// are rejected at the service layer.

export interface Adjudication {
  id: string;
  orgId: string;
  runResultId: string;
  rubricVersionId: string | null;
  finalLabel: string;
  method: string;
  weightingScheme: string | null;
  agreementSummary: unknown | null;
  decidedBy: string | null;
  decidedAt: number;
  locked: boolean;
}

export interface UpsertAdjudicationInput {
  runResultId: string;
  finalLabel: string;
  method: string;
  now: number;
  rubricVersionId?: string | null;
  weightingScheme?: string | null;
  agreementSummary?: unknown | null;
  decidedBy?: string | null;
  locked?: boolean;
  id?: string;
}

export function adjudicationsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.adjudications;

  return {
    /** Insert or replace the adjudication for a result (idempotent on run_result_id). */
    async upsert(orgId: string, input: UpsertAdjudicationInput): Promise<Adjudication> {
      const existing = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.runResultId, input.runResultId)));
      const values = {
        finalLabel: input.finalLabel,
        method: input.method,
        rubricVersionId: input.rubricVersionId ?? null,
        weightingScheme: input.weightingScheme ?? null,
        agreementSummary: input.agreementSummary ?? null,
        decidedBy: input.decidedBy ?? null,
        decidedAt: input.now,
        locked: input.locked ?? false,
      };
      if (existing.length) {
        const [row] = await db
          .update(t)
          .set(values)
          .where(and(eq(t.orgId, orgId), eq(t.runResultId, input.runResultId)))
          .returning();
        return row as Adjudication;
      }
      const [row] = await db
        .insert(t)
        .values({ ...(input.id ? { id: input.id } : {}), orgId, runResultId: input.runResultId, ...values })
        .returning();
      return row as Adjudication;
    },

    async getForResult(orgId: string, runResultId: string): Promise<Adjudication | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.runResultId, runResultId)));
      return (row as Adjudication) ?? null;
    },

    async listForResults(orgId: string, runResultIds: string[]): Promise<Adjudication[]> {
      if (runResultIds.length === 0) return [];
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), inArray(t.runResultId, runResultIds)));
      return rows as Adjudication[];
    },

    /** Lock every adjudication for a set of results (called at finalize). */
    async lockForResults(orgId: string, runResultIds: string[], now: number): Promise<void> {
      if (runResultIds.length === 0) return;
      await db
        .update(t)
        .set({ locked: true, decidedAt: now })
        .where(and(eq(t.orgId, orgId), inArray(t.runResultId, runResultIds)));
    },
  };
}
