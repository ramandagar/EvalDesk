// ============================================================================
// Probes service — guard-wrapped, enqueues adversarial.generate jobs.
// The actual generation runs async in the worker; this returns immediately.
// Follows the same pattern as runs-service (enqueue + 202).
// ============================================================================

import { z } from "zod";
import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import type { projectsRepo } from "@/db/repos/projects";
import type { jobsRepo } from "@/db/repos/jobs";
import type { ProbeType } from "@/lib/ai/safety-probes";

export const probeRequestSchema = z.object({
  type: z.enum(["jailbreak", "prompt_injection", "pii_leak"]),
  count: z.number().int().min(1).max(20).default(5),
});

export interface ProbesServiceDeps {
  guard: ReturnType<typeof guard>;
  projects: ReturnType<typeof projectsRepo>;
  jobs: ReturnType<typeof jobsRepo>;
  now: () => number;
}

export function probesService(deps: ProbesServiceDeps) {
  return {
    /** Enqueue an adversarial probe generation job. Returns immediately (202). */
    async generate(token: string | undefined, orgId: string, projectId: string, type: ProbeType, count: number): Promise<void> {
      await deps.guard.requireMember(token, orgId, "project:write");
      const project = await deps.projects.getInOrg(orgId, projectId);
      if (!project) throw new AuthzError(404, "Not found");
      await deps.jobs.enqueue({
        orgId,
        type: "adversarial.generate",
        payload: { projectId, type, count },
        now: deps.now(),
      });
    },
  };
}
