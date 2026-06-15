import { and, eq, desc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// The rubric pins the enumerated label space that BOTH the AI judge and human
// reviewers rate on, so agreement (kappa) and AI-vs-human calibration are exact
// joins on a shared categorical scale. Versions are immutable: an edit inserts
// a new (project_id, name, version) row. Org-scoped like every repo.

export const DEFAULT_RUBRIC_NAME = "default";
export const DEFAULT_RUBRIC_LABELS = ["fail", "partial", "pass"] as const;

export interface Rubric {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  version: number;
  kind: string; // ordinal | nominal
  labels: string[];
  scaleMin: number | null;
  scaleMax: number | null;
  alwaysHuman: boolean;
  createdAt: number;
}

export function rubricsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.rubrics;

  return {
    /** Latest (highest-version) rubric for a project + name, or null. */
    async getActive(orgId: string, projectId: string, name = DEFAULT_RUBRIC_NAME): Promise<Rubric | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.projectId, projectId), eq(t.name, name)))
        .orderBy(desc(t.version))
        .limit(1);
      return (row as Rubric) ?? null;
    },

    async getById(orgId: string, id: string): Promise<Rubric | null> {
      const [row] = await db.select().from(t).where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as Rubric) ?? null;
    },

    async create(
      orgId: string,
      input: {
        projectId: string;
        now: number;
        name?: string;
        version?: number;
        kind?: string;
        labels?: string[];
        scaleMin?: number | null;
        scaleMax?: number | null;
        alwaysHuman?: boolean;
        id?: string;
      },
    ): Promise<Rubric> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          projectId: input.projectId,
          name: input.name ?? DEFAULT_RUBRIC_NAME,
          version: input.version ?? 1,
          kind: input.kind ?? "ordinal",
          labels: input.labels ?? [...DEFAULT_RUBRIC_LABELS],
          scaleMin: input.scaleMin ?? 0,
          scaleMax: input.scaleMax ?? 100,
          alwaysHuman: input.alwaysHuman ?? false,
          createdAt: input.now,
        })
        .returning();
      return row as Rubric;
    },

    /** Resolve the project's default rubric, creating version 1 if absent. */
    async getOrCreateDefault(orgId: string, projectId: string, now: number): Promise<Rubric> {
      const existing = await this.getActive(orgId, projectId, DEFAULT_RUBRIC_NAME);
      if (existing) return existing;
      return this.create(orgId, { projectId, now });
    },
  };
}
