import { and, eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

export interface TestCase {
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  input: string;
  expectedOutput: string | null;
  context: string | null;
  category: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTestCaseInput {
  projectId: string;
  title: string;
  input: string;
  now: number;
  expectedOutput?: string | null;
  context?: string | null;
  category?: string | null;
  order?: number;
  id?: string;
}

/** Org-scoped test cases. Project-scoped reads also confirm the project's org. */
export function testCasesRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.testCases;

  return {
    async create(orgId: string, input: CreateTestCaseInput): Promise<TestCase> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          projectId: input.projectId,
          title: input.title,
          input: input.input,
          expectedOutput: input.expectedOutput ?? null,
          context: input.context ?? null,
          category: input.category ?? null,
          order: input.order ?? 0,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();
      return row as TestCase;
    },

    async getInOrg(orgId: string, id: string): Promise<TestCase | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as TestCase) ?? null;
    },

    async listForProject(orgId: string, projectId: string): Promise<TestCase[]> {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.projectId, projectId)))
        .orderBy(t.order, t.createdAt);
      return rows as TestCase[];
    },

    async delete(orgId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(t)
        .where(and(eq(t.orgId, orgId), eq(t.id, id)))
        .returning();
      return rows.length > 0;
    },
  };
}
