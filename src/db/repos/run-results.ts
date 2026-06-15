import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

export interface RunResult {
  id: string;
  orgId: string;
  runId: string;
  testCaseId: string;
  agentResponse: string | null;
  responseTimeMs: number | null;
  status: string;
  errorMessage: string | null;
  needsHuman: boolean;
  createdAt: number;
}

export interface CreateRunResultInput {
  runId: string;
  testCaseId: string;
  now: number;
  agentResponse?: string | null;
  responseTimeMs?: number | null;
  status?: string;
  errorMessage?: string | null;
  needsHuman?: boolean;
  id?: string;
}

export function runResultsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.runResults;

  return {
    async create(orgId: string, input: CreateRunResultInput): Promise<RunResult> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          runId: input.runId,
          testCaseId: input.testCaseId,
          agentResponse: input.agentResponse ?? null,
          responseTimeMs: input.responseTimeMs ?? null,
          status: input.status ?? "pending",
          errorMessage: input.errorMessage ?? null,
          needsHuman: input.needsHuman ?? false,
          createdAt: input.now,
        })
        .returning();
      return row as RunResult;
    },

    async getInOrg(orgId: string, id: string): Promise<RunResult | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as RunResult) ?? null;
    },

    async listForRun(orgId: string, runId: string): Promise<RunResult[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.runId, runId)))
        .orderBy(t.createdAt);
      return rows as RunResult[];
    },

    async update(
      orgId: string,
      id: string,
      patch: { needsHuman?: boolean; status?: string },
    ): Promise<RunResult | null> {
      const rows = await db
        .update(t)
        .set(patch)
        .where(and(eq(t.orgId, orgId), eq(t.id, id)))
        .returning();
      return (rows[0] as RunResult) ?? null;
    },
  };
}
