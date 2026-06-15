// ============================================================================
// Projects service. The composition of guard + repos + secret encryption that
// routes call. Every method authorizes via the guard FIRST, scopes all data
// access to the caller's org, encrypts the agent API key into the secrets table
// (never a plaintext column, never returned), and throws AuthzError (mapped to
// HTTP status by the route). This is where "IDOR is structurally impossible"
// becomes a single, reused code path.
// ============================================================================

import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import type { projectsRepo, Project, UpdateProjectPatch } from "@/db/repos/projects";
import type { secretsRepo } from "@/db/repos/secrets";
import { encryptSecret, type Keyring } from "@/lib/crypto/secrets";
import { buildPage, clampLimit, decodeCursor, type Page } from "@/lib/http/cursor";

const SECRET_REF = "project";
const SECRET_NAME = "agent_api_key";
const aad = (orgId: string, projectId: string) =>
  `org:${orgId}:project:${projectId}:agent_api_key`;

export interface ProjectsServiceDeps {
  guard: ReturnType<typeof guard>;
  projects: ReturnType<typeof projectsRepo>;
  secrets: ReturnType<typeof secretsRepo>;
  keyring: Keyring;
  now: () => number;
}

/** Never includes the agent API key; only whether one is set. */
export type PublicProject = Project & { hasAgentApiKey: boolean };

export interface CreateProjectArgs {
  name: string;
  description?: string | null;
  agentEndpoint?: string | null;
  agentMethod?: string;
  agentType?: string | null;
  agentHeaders?: unknown | null;
  defaultModel?: string;
  agentApiKey?: string | null;
}

export type UpdateProjectArgs = UpdateProjectPatch & { agentApiKey?: string | null };

export function projectsService(deps: ProjectsServiceDeps) {
  async function storeKey(orgId: string, projectId: string, key: string) {
    await deps.secrets.put({
      orgId,
      refType: SECRET_REF,
      refId: projectId,
      name: SECRET_NAME,
      ciphertext: encryptSecret(key, deps.keyring, aad(orgId, projectId)),
      now: deps.now(),
    });
  }

  async function hasKey(orgId: string, projectId: string): Promise<boolean> {
    return (await deps.secrets.get(orgId, SECRET_REF, projectId, SECRET_NAME)) !== null;
  }

  return {
    async create(
      token: string | undefined,
      orgId: string,
      args: CreateProjectArgs,
    ): Promise<PublicProject> {
      const ctx = await deps.guard.requireMember(token, orgId, "project:write");
      const project = await deps.projects.create(orgId, {
        name: args.name,
        description: args.description,
        agentEndpoint: args.agentEndpoint,
        agentMethod: args.agentMethod,
        agentType: args.agentType,
        agentHeaders: args.agentHeaders,
        defaultModel: args.defaultModel,
        createdBy: ctx.user.id,
        now: deps.now(),
      });
      if (args.agentApiKey) await storeKey(orgId, project.id, args.agentApiKey);
      return { ...project, hasAgentApiKey: !!args.agentApiKey };
    },

    async get(token: string | undefined, orgId: string, id: string): Promise<PublicProject> {
      await deps.guard.requireMember(token, orgId, "project:read");
      const project = await deps.projects.getInOrg(orgId, id);
      if (!project) throw new AuthzError(404, "Not found");
      return { ...project, hasAgentApiKey: await hasKey(orgId, id) };
    },

    async list(token: string | undefined, orgId: string): Promise<Project[]> {
      await deps.guard.requireMember(token, orgId, "project:read");
      return deps.projects.listForOrg(orgId);
    },

    /** Cursor-paginated list (ordered by created_at,id). Cursor is org+resource scoped. */
    async listPage(
      token: string | undefined,
      orgId: string,
      opts: { limit?: number; cursor?: string } = {},
    ): Promise<Page<Project>> {
      await deps.guard.requireMember(token, orgId, "project:read");
      const limit = clampLimit(opts.limit);
      const after = opts.cursor ? decodeCursor(opts.cursor, orgId, "projects") : undefined;
      const rows = await deps.projects.listPage(orgId, { limit: limit + 1, after });
      return buildPage(rows, limit, orgId, "projects", (p) => ({ createdAt: p.createdAt, id: p.id }));
    },

    async update(
      token: string | undefined,
      orgId: string,
      id: string,
      args: UpdateProjectArgs,
    ): Promise<PublicProject> {
      await deps.guard.requireMember(token, orgId, "project:write");
      const { agentApiKey, ...patch } = args;
      const updated = await deps.projects.update(orgId, id, patch, deps.now());
      if (!updated) throw new AuthzError(404, "Not found");
      if (agentApiKey) await storeKey(orgId, id, agentApiKey);
      return { ...updated, hasAgentApiKey: await hasKey(orgId, id) };
    },

    async remove(token: string | undefined, orgId: string, id: string): Promise<void> {
      await deps.guard.requireMember(token, orgId, "project:write");
      const deleted = await deps.projects.delete(orgId, id);
      if (!deleted) throw new AuthzError(404, "Not found");
    },
  };
}
