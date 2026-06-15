import { and, eq, desc, ne } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

export interface Run {
  id: string;
  orgId: string;
  projectId: string;
  name: string | null;
  status: string;
  totalCases: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  unratedCount: number;
  passRate: number | null;
  triggerType: string;
  triggeredBy: string | null;
  modelUsed: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface CreateRunInput {
  projectId: string;
  now: number;
  name?: string | null;
  status?: string;
  totalCases?: number;
  triggerType?: string;
  triggeredBy?: string | null;
  modelUsed?: string | null;
  id?: string;
}

export interface UpdateRunPatch {
  status?: string;
  totalCases?: number;
  passCount?: number;
  failCount?: number;
  partialCount?: number;
  unratedCount?: number;
  passRate?: number | null;
  completedAt?: number | null;
}

export function runsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.runs;

  return {
    async create(orgId: string, input: CreateRunInput): Promise<Run> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          projectId: input.projectId,
          name: input.name ?? null,
          status: input.status ?? "queued",
          totalCases: input.totalCases ?? 0,
          triggerType: input.triggerType ?? "manual",
          triggeredBy: input.triggeredBy ?? null,
          modelUsed: input.modelUsed ?? null,
          createdAt: input.now,
        })
        .returning();
      return row as Run;
    },

    async getInOrg(orgId: string, id: string): Promise<Run | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as Run) ?? null;
    },

    async listForProject(orgId: string, projectId: string): Promise<Run[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.projectId, projectId)))
        .orderBy(desc(t.createdAt));
      return rows as Run[];
    },

    /** All runs across the org's projects (most recent first). */
    async listForOrg(orgId: string, limit = 100): Promise<Run[]> {
      const rows = await db
        .select()
        .from(t)
        .where(eq(t.orgId, orgId))
        .orderBy(desc(t.createdAt))
        .limit(limit);
      return rows as Run[];
    },

    async update(orgId: string, id: string, patch: UpdateRunPatch): Promise<Run | null> {
      // A "signed" run is finalized + locked: no later job (a retried/late
      // run.judge or run.execute) may downgrade or mutate it. The only update
      // permitted on a signed run is one that re-asserts "signed" (the finalize
      // path is idempotent). This guarantees the certificate's run can't change.
      const conds = [eq(t.orgId, orgId), eq(t.id, id)];
      if (patch.status !== "signed") conds.push(ne(t.status, "signed"));
      const rows = await db
        .update(t)
        .set(patch)
        .where(and(...conds))
        .returning();
      return (rows[0] as Run) ?? null;
    },
  };
}
