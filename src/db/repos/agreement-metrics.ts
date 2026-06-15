import { and, eq, desc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Precomputed inter-rater agreement, written by the worker (never aggregated in
// the request path). Scoped to a run / project / dataset. Append-only history;
// the latest row per scope is the current value.

export interface AgreementMetric {
  id: string;
  orgId: string;
  scopeType: string; // run | project | dataset
  scopeId: string;
  rubricVersionId: string | null;
  aiHumanAgreementPct: number | null;
  aiHumanConfusion: unknown | null;
  kappa: number | null;
  kappaMethod: string | null;
  weightingScheme: string | null;
  nItems: number | null;
  nRaters: number | null;
  ciLo: number | null;
  ciHi: number | null;
  windowStart: number | null;
  windowEnd: number | null;
  computedAt: number;
}

export interface InsertAgreementMetricInput {
  scopeType: string;
  scopeId: string;
  computedAt: number;
  rubricVersionId?: string | null;
  aiHumanAgreementPct?: number | null;
  aiHumanConfusion?: unknown | null;
  kappa?: number | null;
  kappaMethod?: string | null;
  weightingScheme?: string | null;
  nItems?: number | null;
  nRaters?: number | null;
  ciLo?: number | null;
  ciHi?: number | null;
  windowStart?: number | null;
  windowEnd?: number | null;
  id?: string;
}

export function agreementMetricsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.agreementMetrics;

  return {
    async insert(orgId: string, input: InsertAgreementMetricInput): Promise<AgreementMetric> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          rubricVersionId: input.rubricVersionId ?? null,
          aiHumanAgreementPct: input.aiHumanAgreementPct ?? null,
          aiHumanConfusion: input.aiHumanConfusion ?? null,
          kappa: input.kappa ?? null,
          kappaMethod: input.kappaMethod ?? null,
          weightingScheme: input.weightingScheme ?? null,
          nItems: input.nItems ?? null,
          nRaters: input.nRaters ?? null,
          ciLo: input.ciLo ?? null,
          ciHi: input.ciHi ?? null,
          windowStart: input.windowStart ?? null,
          windowEnd: input.windowEnd ?? null,
          computedAt: input.computedAt,
        })
        .returning();
      return row as AgreementMetric;
    },

    async getLatest(orgId: string, scopeType: string, scopeId: string): Promise<AgreementMetric | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.scopeType, scopeType), eq(t.scopeId, scopeId)))
        .orderBy(desc(t.computedAt))
        .limit(1);
      return (row as AgreementMetric) ?? null;
    },
  };
}
