import { and, eq, isNull, inArray } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Layer (b): append-only human verdicts. One CURRENT (non-superseded) row per
// reviewer per result, enforced by a partial unique index. A correction inserts
// a new row with supersedes_id; the UI never UPDATEs. Idempotent submission is
// guarded by the (run_result_id, reviewer_id, attempt_id) unique constraint, so
// a retried POST is a no-op and can never corrupt kappa. Org-scoped.

export interface HumanRating {
  id: string;
  orgId: string;
  runResultId: string;
  rubricVersionId: string | null;
  reviewerId: string | null;
  label: string;
  scoreNum: number | null;
  rationale: string | null;
  confidence: number | null;
  supersedesId: string | null;
  credentialSnapshot: unknown | null;
  signature: string | null;
  signingKeyId: string | null;
  attemptId: string;
  signedAt: number | null;
  createdAt: number;
}

export interface SubmitHumanRatingInput {
  runResultId: string;
  reviewerId: string;
  label: string;
  attemptId: string;
  now: number;
  rubricVersionId?: string | null;
  scoreNum?: number | null;
  rationale?: string | null;
  confidence?: number | null;
  supersedesId?: string | null;
  credentialSnapshot?: unknown | null;
  signature?: string | null;
  signingKeyId?: string | null;
  signedAt?: number | null;
  id?: string;
}

export function humanRatingsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.humanRatings;

  return {
    /**
     * Append a verdict. Idempotent on (run_result_id, reviewer_id, attempt_id):
     * a duplicate submit is a no-op returning the existing row. Returns
     * { rating, inserted }.
     */
    async submit(orgId: string, input: SubmitHumanRatingInput): Promise<{ rating: HumanRating; inserted: boolean }> {
      const inserted = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          runResultId: input.runResultId,
          rubricVersionId: input.rubricVersionId ?? null,
          reviewerId: input.reviewerId,
          label: input.label,
          scoreNum: input.scoreNum ?? null,
          rationale: input.rationale ?? null,
          confidence: input.confidence ?? null,
          supersedesId: input.supersedesId ?? null,
          credentialSnapshot: input.credentialSnapshot ?? null,
          signature: input.signature ?? null,
          signingKeyId: input.signingKeyId ?? null,
          attemptId: input.attemptId,
          signedAt: input.signedAt ?? null,
          createdAt: input.now,
        })
        .onConflictDoNothing({ target: [t.runResultId, t.reviewerId, t.attemptId] })
        .returning();

      if (inserted.length) return { rating: inserted[0] as HumanRating, inserted: true };
      const [existing] = await db
        .select()
        .from(t)
        .where(
          and(
            eq(t.orgId, orgId),
            eq(t.runResultId, input.runResultId),
            eq(t.reviewerId, input.reviewerId),
            eq(t.attemptId, input.attemptId),
          ),
        );
      return { rating: existing as HumanRating, inserted: false };
    },

    /** Current (non-superseded) ratings for a result. */
    async listCurrentForResult(orgId: string, runResultId: string): Promise<HumanRating[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.runResultId, runResultId), isNull(t.supersedesId)))
        .orderBy(t.createdAt);
      return rows as HumanRating[];
    },

    /** Current (non-superseded) ratings across many results (calibration join). */
    async listCurrentForResults(orgId: string, runResultIds: string[]): Promise<HumanRating[]> {
      if (runResultIds.length === 0) return [];
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), inArray(t.runResultId, runResultIds), isNull(t.supersedesId)))
        .orderBy(t.createdAt);
      return rows as HumanRating[];
    },
  };
}
