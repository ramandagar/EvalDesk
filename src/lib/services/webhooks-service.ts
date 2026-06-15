// ============================================================================
// Webhooks service — guarded registration of webhook endpoints. The signing
// secret is generated server-side, returned ONCE at creation (never again), and
// stored only as an AES-GCM ciphertext with an AAD bound to the webhook id. The
// URL is SSRF-checked at registration. webhook:manage is admin+ (RBAC).
// ============================================================================

import { randomBytes } from "node:crypto";
import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import { encryptSecret, type Keyring } from "@/lib/crypto/secrets";
import { assertAllowedUrl, SSRFError } from "@/lib/net/ssrf";
import { createId } from "@/lib/utils";
import type { webhooksRepo, Webhook } from "@/db/repos/webhooks";

const KNOWN_EVENTS = ["run.completed", "run.failed", "regression.detected", "certificate.signed", "verdict.submitted"] as const;
const secretAad = (orgId: string, webhookId: string) => `webhook:${orgId}:${webhookId}:secret`;

export interface WebhooksServiceDeps {
  guard: ReturnType<typeof guard>;
  webhooks: ReturnType<typeof webhooksRepo>;
  keyring: Keyring;
  now: () => number;
}

/** Public shape never includes the ciphertext. */
export type PublicWebhook = Omit<Webhook, "secretCiphertext">;

function toPublic(w: Webhook): PublicWebhook {
  const { secretCiphertext: _omit, ...rest } = w;
  void _omit;
  return rest;
}

export function webhooksService(deps: WebhooksServiceDeps) {
  return {
    async create(
      token: string | undefined,
      orgId: string,
      args: { url: string; events: string[]; projectId?: string | null },
    ): Promise<PublicWebhook & { secret: string }> {
      const ctx = await deps.guard.requireMember(token, orgId, "webhook:manage");

      try {
        const url = assertAllowedUrl(args.url); // syntactic SSRF check (scheme/host/creds)
        // Webhooks must be https — the authoritative IP-pinned block runs again at delivery.
        if (url.protocol !== "https:") throw new SSRFError("Webhook URL must use https");
      } catch (e) {
        if (e instanceof SSRFError) throw new AuthzError(400, `Invalid webhook URL: ${e.message}`);
        throw e;
      }
      const events = args.events.filter((e) => (KNOWN_EVENTS as readonly string[]).includes(e));
      if (events.length === 0) throw new AuthzError(400, "At least one valid event is required");

      const id = createId();
      const secret = `whsec_${randomBytes(24).toString("hex")}`;
      const created = await deps.webhooks.create(orgId, {
        id,
        url: args.url,
        secretCiphertext: encryptSecret(secret, deps.keyring, secretAad(orgId, id)),
        events,
        projectId: args.projectId ?? null,
        createdBy: ctx.user.id,
        now: deps.now(),
      });
      // the plaintext secret is returned ONCE, here only
      return { ...toPublic(created), secret };
    },

    async list(token: string | undefined, orgId: string): Promise<PublicWebhook[]> {
      await deps.guard.requireMember(token, orgId, "webhook:manage");
      return (await deps.webhooks.listForOrg(orgId)).map(toPublic);
    },
  };
}
