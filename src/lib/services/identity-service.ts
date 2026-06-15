// ============================================================================
// Identity service — the bootstrap a client calls to discover WHO it is and
// WHICH orgs it may act in, so it can set X-Org-Id on subsequent calls. This is
// the one v1 endpoint that is intentionally NOT org-scoped: it returns only the
// caller's OWN memberships (no cross-tenant data), resolved from the session.
// ============================================================================

import { AuthzError } from "@/lib/auth/guard";
import type { sessionService } from "@/lib/auth/session";
import type { membershipsRepo } from "@/db/repos/memberships";
import type { organizationsRepo } from "@/db/repos/organizations";
import type { usersRepo } from "@/db/repos/users";

export interface IdentityServiceDeps {
  sessions: ReturnType<typeof sessionService>;
  memberships: ReturnType<typeof membershipsRepo>;
  orgs: ReturnType<typeof organizationsRepo>;
  users: ReturnType<typeof usersRepo>;
}

export interface MeResponse {
  user: { id: string; email: string };
  activeOrgId: string | null;
  orgs: Array<{ id: string; name: string; slug: string; role: string }>;
}

export function identityService(deps: IdentityServiceDeps) {
  return {
    async me(token: string | undefined): Promise<MeResponse> {
      const session = token ? await deps.sessions.validate(token) : null;
      if (!session) throw new AuthzError(401, "Authentication required");
      const user = await deps.users.getById(session.userId);
      if (!user) throw new AuthzError(401, "Authentication required");

      const memberships = await deps.memberships.listForUser(session.userId);
      const orgs = await Promise.all(
        memberships.map(async (m) => {
          const org = await deps.orgs.getById(m.orgId);
          return { id: m.orgId, name: org?.name ?? "", slug: org?.slug ?? "", role: m.role };
        }),
      );
      return {
        user: { id: user.id, email: user.email },
        activeOrgId: session.orgId ?? orgs[0]?.id ?? null,
        orgs,
      };
    },
  };
}
