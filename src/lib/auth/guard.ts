// ============================================================================
// The authorization guard — the single sanctioned gate for every protected
// operation. This is what makes IDOR structurally impossible:
//
//   1. requireMember(token, orgId, capability) resolves the caller's session,
//      confirms they are a MEMBER of that org, and checks the capability.
//      A non-member (or unknown org) gets 404 — never 403 — so org ids can't be
//      enumerated.
//   2. assertInOrg(resource, ctx) confirms any loaded child resource belongs to
//      the caller's org before it is read or mutated. A resource from another
//      org is indistinguishable from "not found".
//
// Framework-agnostic and fully dependency-injected; the HTTP binding (reading
// the cookie/Bearer, mapping AuthzError.status to a response) is a thin wrapper.
// ============================================================================

import type { usersRepo, User } from "@/db/repos/users";
import type { membershipsRepo, Membership } from "@/db/repos/memberships";
import type { apiKeysRepo } from "@/db/repos/api-keys";
import { hashToken } from "@/lib/crypto/tokens";
import type { sessionService } from "./session";
import { can, type Capability, type Role } from "./roles";

/** Machine API keys carry the `evaldesk_live_` prefix; session tokens never do. */
export const API_KEY_PREFIX = "evaldesk_live_";

/** Default capabilities for an API key with no explicit scopes: full OPERATIONAL
 *  access, but never account/billing/member/key administration. */
export const DEFAULT_API_KEY_SCOPES: Capability[] = [
  "org:read",
  "project:read",
  "project:write",
  "run:read",
  "run:execute",
  "run:approve",
  "result:rate",
  "result:adjudicate",
  "webhook:manage",
];

export type AuthzStatus = 400 | 401 | 403 | 404 | 409;

export class AuthzError extends Error {
  constructor(
    public readonly status: AuthzStatus,
    message: string,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export interface AccessContext {
  user: User;
  membership: Membership;
  role: Role;
  orgId: string;
}

export interface GuardDeps {
  sessions: ReturnType<typeof sessionService>;
  memberships: ReturnType<typeof membershipsRepo>;
  users: ReturnType<typeof usersRepo>;
  apiKeys: ReturnType<typeof apiKeysRepo>;
  now: () => number;
}

export function guard(deps: GuardDeps) {
  /** Authenticate a machine API key (Bearer evaldesk_live_…) for one org. */
  async function requireApiKey(token: string, orgId: string, capability: Capability): Promise<AccessContext> {
    const key = await deps.apiKeys.resolveByHash(hashToken(token), deps.now());
    if (!key) throw new AuthzError(401, "Invalid or expired API key");
    // The key is bound to one org; using it against another → 404 (no enumeration).
    if (key.orgId !== orgId) throw new AuthzError(404, "Not found");
    const scopes = (key.scopes as Capability[] | null) ?? DEFAULT_API_KEY_SCOPES;
    if (!scopes.includes(capability)) throw new AuthzError(403, "API key missing required scope");
    // Synthetic principal — the key acts as an "admin"-equivalent within its scopes.
    const user = { id: `apikey:${key.id}`, name: key.name, email: "" } as User;
    const membership = { orgId, userId: user.id, role: "admin" } as Membership;
    return { user, membership, role: "admin", orgId };
  }

  return {
    async requireMember(
      token: string | undefined | null,
      orgId: string,
      capability: Capability,
    ): Promise<AccessContext> {
      // Machine API key path (SDK / CI / programmatic).
      if (token && token.startsWith(API_KEY_PREFIX)) {
        return requireApiKey(token, orgId, capability);
      }

      // Browser session path.
      const session = token ? await deps.sessions.validate(token) : null;
      if (!session) throw new AuthzError(401, "Authentication required");

      const membership = await deps.memberships.get(orgId, session.userId);
      // Cross-tenant or unknown org → 404 (no 403, no enumeration).
      if (!membership) throw new AuthzError(404, "Not found");

      const role = membership.role;
      if (!can(role, capability)) throw new AuthzError(403, "Insufficient permissions");

      const user = await deps.users.getById(session.userId);
      if (!user) throw new AuthzError(401, "Authentication required");

      return { user, membership, role, orgId };
    },

    /** Confirm a loaded resource belongs to the caller's org, else 404. */
    assertInOrg<T extends { orgId: string }>(
      resource: T | null | undefined,
      ctx: AccessContext,
    ): T {
      if (!resource || resource.orgId !== ctx.orgId) throw new AuthzError(404, "Not found");
      return resource;
    },
  };
}
