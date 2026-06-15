import { and, eq, inArray } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Layer (a) of the verdict separation: immutable AI-judge scores. MANY rows per
// run_result (ensemble × samples). Writes are idempotent on `idempotency_key`
// so an at-least-once queue can re-run a judge job without double-counting
// calibration or inflating cost metering. There is no update/delete path — the
// AI never mutates a verdict; corrections are new rows.

export interface AiScore {
  id: string;
  orgId: string;
  runResultId: string;
  rubricVersionId: string | null;
  judgeConfigVersionId: string | null;
  provider: string | null;
  model: string;
  modelResolved: string | null;
  promptHash: string | null;
  label: string;
  scoreNum: number | null;
  confidence: number | null;
  selfConsistency: number | null;
  disagreement: number | null;
  rationale: string | null;
  raw: unknown | null;
  idempotencyKey: string;
  createdAt: number;
}

export interface InsertAiScoreInput {
  runResultId: string;
  model: string;
  label: string;
  idempotencyKey: string;
  now: number;
  rubricVersionId?: string | null;
  judgeConfigVersionId?: string | null;
  provider?: string | null;
  modelResolved?: string | null;
  promptHash?: string | null;
  scoreNum?: number | null;
  confidence?: number | null;
  selfConsistency?: number | null;
  disagreement?: number | null;
  rationale?: string | null;
  raw?: unknown | null;
  id?: string;
}

export function aiScoresRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.aiScores;

  return {
    /**
     * Insert one AI score. Idempotent: a duplicate idempotency_key is a no-op
     * and the EXISTING row is returned, so retries never double-write. Returns
     * { score, inserted } so callers can tell a fresh write from a replay.
     */
    async insertIdempotent(orgId: string, input: InsertAiScoreInput): Promise<{ score: AiScore; inserted: boolean }> {
      const inserted = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          runResultId: input.runResultId,
          rubricVersionId: input.rubricVersionId ?? null,
          judgeConfigVersionId: input.judgeConfigVersionId ?? null,
          provider: input.provider ?? null,
          model: input.model,
          modelResolved: input.modelResolved ?? null,
          promptHash: input.promptHash ?? null,
          label: input.label,
          scoreNum: input.scoreNum ?? null,
          confidence: input.confidence ?? null,
          selfConsistency: input.selfConsistency ?? null,
          disagreement: input.disagreement ?? null,
          rationale: input.rationale ?? null,
          raw: input.raw ?? null,
          idempotencyKey: input.idempotencyKey,
          createdAt: input.now,
        })
        .onConflictDoNothing({ target: t.idempotencyKey })
        .returning();

      if (inserted.length) return { score: inserted[0] as AiScore, inserted: true };

      // Conflict: the row already exists — return it unchanged.
      const [existing] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.idempotencyKey, input.idempotencyKey)));
      return { score: existing as AiScore, inserted: false };
    },

    async listForResult(orgId: string, runResultId: string): Promise<AiScore[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.runResultId, runResultId)))
        .orderBy(t.createdAt);
      return rows as AiScore[];
    },

    async listForResults(orgId: string, runResultIds: string[]): Promise<AiScore[]> {
      if (runResultIds.length === 0) return [];
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), inArray(t.runResultId, runResultIds)))
        .orderBy(t.createdAt);
      return rows as AiScore[];
    },
  };
}
