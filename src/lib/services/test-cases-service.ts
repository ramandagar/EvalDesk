// Test-cases service — same guarded, org-scoped pattern as projects. Confirms
// the parent project belongs to the caller's org before any write/read.
import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import type { projectsRepo } from "@/db/repos/projects";
import type { testCasesRepo, TestCase } from "@/db/repos/test-cases";

export interface TestCasesServiceDeps {
  guard: ReturnType<typeof guard>;
  projects: ReturnType<typeof projectsRepo>;
  testCases: ReturnType<typeof testCasesRepo>;
  now: () => number;
}

export interface CreateTestCaseArgs {
  projectId: string;
  title: string;
  input: string;
  expectedOutput?: string | null;
  category?: string | null;
  order?: number;
}

export function testCasesService(deps: TestCasesServiceDeps) {
  async function requireProject(orgId: string, projectId: string) {
    const project = await deps.projects.getInOrg(orgId, projectId);
    if (!project) throw new AuthzError(404, "Not found");
    return project;
  }

  return {
    async create(token: string | undefined, orgId: string, args: CreateTestCaseArgs): Promise<TestCase> {
      await deps.guard.requireMember(token, orgId, "project:write");
      await requireProject(orgId, args.projectId);
      return deps.testCases.create(orgId, { ...args, now: deps.now() });
    },

    async listForProject(token: string | undefined, orgId: string, projectId: string): Promise<TestCase[]> {
      await deps.guard.requireMember(token, orgId, "project:read");
      await requireProject(orgId, projectId);
      return deps.testCases.listForProject(orgId, projectId);
    },

    async get(token: string | undefined, orgId: string, id: string): Promise<TestCase> {
      await deps.guard.requireMember(token, orgId, "project:read");
      const tc = await deps.testCases.getInOrg(orgId, id);
      if (!tc) throw new AuthzError(404, "Not found");
      return tc;
    },

    async remove(token: string | undefined, orgId: string, id: string): Promise<void> {
      await deps.guard.requireMember(token, orgId, "project:write");
      const ok = await deps.testCases.delete(orgId, id);
      if (!ok) throw new AuthzError(404, "Not found");
    },
  };
}
