// ============================================================================
// API keys service — guarded creation/listing/revocation of machine keys for
// the SDK / GitHub Action / programmatic API. The raw key is generated server-
// side, returned ONCE at creation, and stored only as a SHA-256 hash. key:manage
// is owner/admin only (RBAC). Keys are org-bound; the org is later resolved from
// the key, never trusted from a header.
// ============================================================================

import { randomBytes } from "node:crypto";
import type { guard } from "@/lib/auth/guard";
import { AuthzError, DEFAULT_API_KEY_SCOPES, API_KEY_PREFIX } from "@/lib/auth/guard";
import { hashToken } from "@/lib/crypto/tokens";
import type { Capability } from "@/lib/auth/roles";
import type { apiKeysRepo, ApiKey } from "@/db/repos/api-keys";

export interface ApiKeysServiceDeps {
  guard: ReturnType<typeof guard>;
  apiKeys: ReturnType<typeof apiKeysRepo>;
  now: () => number;
}

/** Public shape — never the hash. */
export type PublicApiKey = Omit<ApiKey, "keyHash">;
function toPublic(k: ApiKey): PublicApiKey {
  const { keyHash: _omit, ...rest } = k;
  void _omit;
  return rest;
}

export function apiKeysService(deps: ApiKeysServiceDeps) {
  return {
    async create(
      token: string | undefined,
      orgId: string,
      args: { name: string; scopes?: Capability[]; expiresAt?: number | null },
    ): Promise<PublicApiKey & { key: string }> {
      const ctx = await deps.guard.requireMember(token, orgId, "key:manage");

      // evaldesk_live_<48 hex>; only the prefix is shown later.
      const raw = `${API_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
      const scopes = (args.scopes ?? DEFAULT_API_KEY_SCOPES).filter((s) => DEFAULT_API_KEY_SCOPES.includes(s));

      const created = await deps.apiKeys.create(orgId, {
        name: args.name,
        keyHash: hashToken(raw),
        keyPrefix: raw.slice(0, API_KEY_PREFIX.length + 6),
        scopes,
        createdBy: ctx.user.id,
        expiresAt: args.expiresAt ?? null,
        now: deps.now(),
      });
      return { ...toPublic(created), key: raw }; // raw key returned ONCE
    },

    async list(token: string | undefined, orgId: string): Promise<PublicApiKey[]> {
      await deps.guard.requireMember(token, orgId, "key:manage");
      return (await deps.apiKeys.listForOrg(orgId)).map(toPublic);
    },

    async revoke(token: string | undefined, orgId: string, id: string): Promise<void> {
      await deps.guard.requireMember(token, orgId, "key:manage");
      const ok = await deps.apiKeys.revoke(orgId, id, deps.now());
      if (!ok) throw new AuthzError(404, "Not found");
    },
  };
}
