// ============================================================================
// Import service — guarded ingestion of an evals dataset into a project's test
// cases. Replaces the legacy zero-auth bulk endpoint: authorizes first, verifies
// the project under ctx.orgId (404 otherwise), enforces size/item caps (413),
// detects+parses the format (400 on parse failure), and bulk-creates test cases.
// ============================================================================

import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import { ApiError } from "@/lib/http/errors";
import { detectAndParse, ImportError, type NormalizedTestCase } from "@/lib/import/adapters";
import type { projectsRepo } from "@/db/repos/projects";
import type { testCasesRepo } from "@/db/repos/test-cases";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ITEMS = 5000;

export interface ImportServiceDeps {
  guard: ReturnType<typeof guard>;
  projects: ReturnType<typeof projectsRepo>;
  testCases: ReturnType<typeof testCasesRepo>;
  now: () => number;
}

export interface ImportResult {
  format: string;
  imported: number;
}

export function importService(deps: ImportServiceDeps) {
  return {
    async importDataset(token: string | undefined, orgId: string, projectId: string, raw: string): Promise<ImportResult> {
      await deps.guard.requireMember(token, orgId, "project:write");

      const project = await deps.projects.getInOrg(orgId, projectId);
      if (!project) throw new AuthzError(404, "Not found");

      if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) throw new ApiError(413, "Dataset exceeds 5 MB limit");

      let format: string;
      let cases: NormalizedTestCase[];
      try {
        const result = detectAndParse(raw);
        format = result.adapter.id;
        cases = result.cases;
      } catch (e) {
        if (e instanceof ImportError) {
          const status = e.code === "unknown_format" ? 422 : 400;
          throw new ApiError(status, e.line ? `${e.message} (line ${e.line})` : e.message);
        }
        throw e;
      }

      if (cases.length === 0) throw new ApiError(400, "No test cases found in dataset");
      if (cases.length > MAX_ITEMS) throw new ApiError(413, `Dataset has ${cases.length} items (max ${MAX_ITEMS})`);

      // determine the starting order from existing cases (append, don't clobber)
      const existing = await deps.testCases.listForProject(orgId, projectId);
      let order = existing.length;
      for (const tc of cases) {
        await deps.testCases.create(orgId, {
          projectId,
          title: tc.title,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          category: tc.category,
          order: order++,
          now: deps.now(),
        });
      }
      return { format, imported: cases.length };
    },
  };
}
