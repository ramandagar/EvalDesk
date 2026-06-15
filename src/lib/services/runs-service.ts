// Runs service. Creating a run authorizes (run:execute), validates the project
// + agent config, persists a queued run, and ENQUEUES a job — it never executes
// inline (no LLM/HTTP on the request thread). The worker drains the job. Reads
// are org-scoped like everything else.
import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import { ApiError } from "@/lib/http/errors";
import type { projectsRepo } from "@/db/repos/projects";
import type { runsRepo, Run } from "@/db/repos/runs";
import type { jobsRepo } from "@/db/repos/jobs";

export interface RunsServiceDeps {
  guard: ReturnType<typeof guard>;
  projects: ReturnType<typeof projectsRepo>;
  runs: ReturnType<typeof runsRepo>;
  jobs: ReturnType<typeof jobsRepo>;
  now: () => number;
}

export function runsService(deps: RunsServiceDeps) {
  return {
    async create(token: string | undefined, orgId: string, projectId: string, name?: string): Promise<Run> {
      const ctx = await deps.guard.requireMember(token, orgId, "run:execute");
      const project = await deps.projects.getInOrg(orgId, projectId);
      if (!project) throw new AuthzError(404, "Not found");
      if (!project.agentEndpoint) {
        throw new ApiError(400, "Project has no agent endpoint configured");
      }

      const run = await deps.runs.create(orgId, {
        projectId,
        name: name ?? null,
        status: "queued",
        triggeredBy: ctx.user.id,
        modelUsed: project.defaultModel,
        now: deps.now(),
      });

      await deps.jobs.enqueue({
        orgId,
        type: "run.execute",
        payload: { runId: run.id, projectId },
        now: deps.now(),
      });

      return run;
    },

    async get(token: string | undefined, orgId: string, id: string): Promise<Run> {
      await deps.guard.requireMember(token, orgId, "run:read");
      const run = await deps.runs.getInOrg(orgId, id);
      if (!run) throw new AuthzError(404, "Not found");
      return run;
    },

    async listForProject(token: string | undefined, orgId: string, projectId: string): Promise<Run[]> {
      await deps.guard.requireMember(token, orgId, "run:read");
      const project = await deps.projects.getInOrg(orgId, projectId);
      if (!project) throw new AuthzError(404, "Not found");
      return deps.runs.listForProject(orgId, projectId);
    },

    /** All runs across the org (no project filter). */
    async listForOrg(token: string | undefined, orgId: string): Promise<Run[]> {
      await deps.guard.requireMember(token, orgId, "run:read");
      return deps.runs.listForOrg(orgId);
    },
  };
}
