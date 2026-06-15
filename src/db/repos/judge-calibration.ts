import { and, eq, desc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Precomputed judge calibration per project + judge model: the AI-vs-human gap
// and the learned auto-finalize threshold τ. Append-only history; the latest
// PUBLISHED row drives the judge's routing (τ is only trusted once cold-start
// gates pass). The judge handler reads getLatestPublished to gate auto-finalize.

export interface JudgeCalibration {
  id: string;
  orgId: string;
  projectId: string;
  judgeModel: string;
  judgePromptHash: string | null;
  weightingScheme: string | null;
  windowStart: number | null;
  windowEnd: number | null;
  sampleN: number | null;
  auditSampleN: number | null;
  agreementPct: number | null;
  weightedKappa: number | null;
  confusion: unknown | null;
  bias: unknown | null;
  meanAbsScoreError: number | null;
  tau: number | null;
  published: boolean;
  computedAt: number;
}

export interface InsertJudgeCalibrationInput {
  projectId: string;
  judgeModel: string;
  computedAt: number;
  judgePromptHash?: string | null;
  weightingScheme?: string | null;
  windowStart?: number | null;
  windowEnd?: number | null;
  sampleN?: number | null;
  auditSampleN?: number | null;
  agreementPct?: number | null;
  weightedKappa?: number | null;
  confusion?: unknown | null;
  bias?: unknown | null;
  meanAbsScoreError?: number | null;
  tau?: number | null;
  published?: boolean;
  id?: string;
}

export function judgeCalibrationRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.judgeCalibration;

  return {
    async insert(orgId: string, input: InsertJudgeCalibrationInput): Promise<JudgeCalibration> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          projectId: input.projectId,
          judgeModel: input.judgeModel,
          judgePromptHash: input.judgePromptHash ?? null,
          weightingScheme: input.weightingScheme ?? null,
          windowStart: input.windowStart ?? null,
          windowEnd: input.windowEnd ?? null,
          sampleN: input.sampleN ?? null,
          auditSampleN: input.auditSampleN ?? null,
          agreementPct: input.agreementPct ?? null,
          weightedKappa: input.weightedKappa ?? null,
          confusion: input.confusion ?? null,
          bias: input.bias ?? null,
          meanAbsScoreError: input.meanAbsScoreError ?? null,
          tau: input.tau ?? null,
          published: input.published ?? false,
          computedAt: input.computedAt,
        })
        .returning();
      return row as JudgeCalibration;
    },

    async getLatest(orgId: string, projectId: string, judgeModel: string): Promise<JudgeCalibration | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.projectId, projectId), eq(t.judgeModel, judgeModel)))
        .orderBy(desc(t.computedAt))
        .limit(1);
      return (row as JudgeCalibration) ?? null;
    },

    /** Latest PUBLISHED calibration (drives τ-gated auto-finalize). */
    async getLatestPublished(orgId: string, projectId: string, judgeModel: string): Promise<JudgeCalibration | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(
          and(eq(t.orgId, orgId), eq(t.projectId, projectId), eq(t.judgeModel, judgeModel), eq(t.published, true)),
        )
        .orderBy(desc(t.computedAt))
        .limit(1);
      return (row as JudgeCalibration) ?? null;
    },
  };
}
