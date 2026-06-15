import { and, eq, desc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// The quorum required to finalize + sign a run: min reviewers, an optional
// required role, an optional verified-credential gate, and an optional inter-
// rater kappa floor. Org-scoped, per project.

export interface SignoffPolicy {
  id: string;
  orgId: string;
  projectId: string;
  minReviewers: number;
  requiredRole: string | null;
  requireVerifiedCredential: boolean;
  minKappa: number | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: number;
}

export function signoffPoliciesRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.signoffPolicies;

  return {
    async create(
      orgId: string,
      input: {
        projectId: string;
        now: number;
        minReviewers?: number;
        requiredRole?: string | null;
        requireVerifiedCredential?: boolean;
        minKappa?: number | null;
        createdBy?: string | null;
        id?: string;
      },
    ): Promise<SignoffPolicy> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId,
          projectId: input.projectId,
          minReviewers: input.minReviewers ?? 1,
          requiredRole: input.requiredRole ?? null,
          requireVerifiedCredential: input.requireVerifiedCredential ?? false,
          minKappa: input.minKappa ?? null,
          isActive: true,
          createdBy: input.createdBy ?? null,
          createdAt: input.now,
        })
        .returning();
      return row as SignoffPolicy;
    },

    /** Latest active policy for a project, or null (→ default policy at the service). */
    async getActive(orgId: string, projectId: string): Promise<SignoffPolicy | null> {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.orgId, orgId), eq(t.projectId, projectId), eq(t.isActive, true)))
        .orderBy(desc(t.createdAt))
        .limit(1);
      return (row as SignoffPolicy) ?? null;
    },
  };
}
