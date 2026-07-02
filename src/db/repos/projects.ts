import { and, eq, or, gt, asc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";
import type { CursorKey } from "@/lib/http/cursor";

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  agentEndpoint: string | null;
  agentMethod: string;
  agentType: string | null;
  agentHeaders: unknown | null;
  defaultModel: string;
  judgeBaseUrl: string | null;
  judgeModel: string | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProjectInput {
  name: string;
  now: number;
  description?: string | null;
  agentEndpoint?: string | null;
  agentMethod?: string;
  agentType?: string | null;
  agentHeaders?: unknown | null;
  defaultModel?: string;
  judgeBaseUrl?: string | null;
  judgeModel?: string | null;
  createdBy?: string | null;
  id?: string;
}

export interface UpdateProjectPatch {
  name?: string;
  description?: string | null;
  agentEndpoint?: string | null;
  agentMethod?: string;
  agentType?: string | null;
  agentHeaders?: unknown | null;
  defaultModel?: string;
  judgeBaseUrl?: string | null;
  judgeModel?: string | null;
}

/**
 * Projects repository. EVERY method is org-scoped: reads/updates/deletes filter
 * by (org_id, id), so a caller can never touch another org's project even with
 * a valid id. This is the data-layer half of the IDOR defense.
 */
export function projectsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.projects;

  return {
    async create(orgId: string, input: CreateProjectInput): Promise<Project> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          name: input.name,
          description: input.description ?? null,
          agentEndpoint: input.agentEndpoint ?? null,
          agentMethod: input.agentMethod ?? "POST",
          agentType: input.agentType ?? null,
          agentHeaders: input.agentHeaders ?? null,
          defaultModel: input.defaultModel ?? "gpt-4o-mini",
          judgeBaseUrl: input.judgeBaseUrl ?? null,
          judgeModel: input.judgeModel ?? null,
          createdBy: input.createdBy ?? null,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();
      return row as Project;
    },

    async getInOrg(orgId: string, id: string): Promise<Project | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.id, id)));
      return (row as Project) ?? null;
    },

    async listForOrg(orgId: string): Promise<Project[]> {
      const rows = await db.select().from(t).where(eq(t.orgId, orgId)).orderBy(t.createdAt);
      return rows as Project[];
    },

    /**
     * Keyset page: ordered by (created_at, id); when `after` is given, returns
     * rows strictly after that position. Fetches up to `limit` rows (caller
     * passes limit+1 to detect more). Identical ordering on SQLite + Postgres.
     */
    async listPage(orgId: string, opts: { limit: number; after?: CursorKey }): Promise<Project[]> {
      const conds = [eq(t.orgId, orgId)];
      if (opts.after) {
        conds.push(
          or(
            gt(t.createdAt, opts.after.createdAt),
            and(eq(t.createdAt, opts.after.createdAt), gt(t.id, opts.after.id)),
          )!,
        );
      }
      const rows = await db
        .select()
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.createdAt), asc(t.id))
        .limit(opts.limit);
      return rows as Project[];
    },

    async update(
      orgId: string,
      id: string,
      patch: UpdateProjectPatch,
      now: number,
    ): Promise<Project | null> {
      const set = {
        updatedAt: now,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.agentEndpoint !== undefined ? { agentEndpoint: patch.agentEndpoint } : {}),
        ...(patch.agentMethod !== undefined ? { agentMethod: patch.agentMethod } : {}),
        ...(patch.agentType !== undefined ? { agentType: patch.agentType } : {}),
        ...(patch.agentHeaders !== undefined ? { agentHeaders: patch.agentHeaders } : {}),
        ...(patch.defaultModel !== undefined ? { defaultModel: patch.defaultModel } : {}),
        ...(patch.judgeBaseUrl !== undefined ? { judgeBaseUrl: patch.judgeBaseUrl } : {}),
        ...(patch.judgeModel !== undefined ? { judgeModel: patch.judgeModel } : {}),
      };
      const rows = await db
        .update(t)
        .set(set)
        .where(and(eq(t.orgId, orgId), eq(t.id, id)))
        .returning();
      return (rows[0] as Project) ?? null;
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
