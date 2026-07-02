// ============================================================================
// Judge resolver — picks the AI judge for a run. A project can configure its
// OWN judge (any OpenAI-compatible baseUrl + model, key encrypted like the
// agent key); that takes precedence. Otherwise it falls back to the operator's
// env-configured judge (deps.judge). Returns undefined when neither is set
// (human-only review). Pure of the worker — takes injected repos + keyring.
// ============================================================================

import { providerFromConfig } from "@/lib/provider-factory";
import { decryptSecret, type Keyring } from "@/lib/crypto/secrets";
import type { projectsRepo } from "@/db/repos/projects";
import type { secretsRepo } from "@/db/repos/secrets";
import type { Provider } from "@/lib/ai/provider";
import type { JudgeConfig } from "@/lib/worker/handlers";

const JUDGE_KEY_NAME = "judge_api_key";
const aad = (orgId: string, projectId: string) => `org:${orgId}:project:${projectId}:${JUDGE_KEY_NAME}`;

export interface JudgeResolverDeps {
  projects: ReturnType<typeof projectsRepo>;
  secrets: ReturnType<typeof secretsRepo>;
  keyring: Keyring;
}

/**
 * Resolve the judge for a project. Per-project config wins; env fallback next;
 * undefined when nothing is configured (the caller leaves results for humans).
 * `judgeBaseUrl` alone is enough to judge (no key = local/no-auth endpoints).
 */
export async function resolveProjectJudge(
  deps: JudgeResolverDeps,
  orgId: string,
  projectId: string,
  fallback?: JudgeConfig,
): Promise<{ provider: Provider; specs: JudgeConfig["specs"]; auditRate?: number; allowSingleJudgeAutoFinalize?: boolean } | undefined> {
  const project = await deps.projects.getInOrg(orgId, projectId);
  if (project?.judgeBaseUrl) {
    const blob = await deps.secrets.get(orgId, "project", projectId, JUDGE_KEY_NAME);
    const apiKey = blob ? decryptSecret(blob, deps.keyring, aad(orgId, projectId)) : "";
    return {
      provider: providerFromConfig({ baseUrl: project.judgeBaseUrl, apiKey }),
      specs: [{ model: project.judgeModel || "gpt-4o-mini" }],
      auditRate: fallback?.auditRate,
      allowSingleJudgeAutoFinalize: fallback?.allowSingleJudgeAutoFinalize,
    };
  }
  return fallback;
}
