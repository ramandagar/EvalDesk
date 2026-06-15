// ============================================================================
// Webhook dispatch + delivery. dispatchEvent fans an event out to every active
// webhook subscribed to it: it writes a delivery row and enqueues a
// webhook.deliver job (so delivery is async + retried via the jobs queue).
// deliverWebhook (the worker handler) decrypts the signing secret, signs the
// EXACT bytes it sends, posts through the SSRF guard, and records the outcome —
// throwing on failure so the queue retries with backoff.
// ============================================================================

import { decryptSecret, type Keyring } from "@/lib/crypto/secrets";
import { guardedFetch, type SafeFetchDeps } from "@/lib/net/ssrf";
import { buildSignatureHeader, SIGNATURE_HEADER } from "./signing";
import type { webhooksRepo } from "@/db/repos/webhooks";
import type { webhookDeliveriesRepo } from "@/db/repos/webhook-deliveries";
import type { jobsRepo } from "@/db/repos/jobs";

const WEBHOOK_MAX_ATTEMPTS = 5;
const secretAad = (orgId: string, webhookId: string) => `webhook:${orgId}:${webhookId}:secret`;

export interface DispatchDeps {
  webhooks: ReturnType<typeof webhooksRepo>;
  deliveries: ReturnType<typeof webhookDeliveriesRepo>;
  jobs: ReturnType<typeof jobsRepo>;
  now: () => number;
}

/** Fan an event out to subscribed webhooks. Returns the delivery ids created. */
export async function dispatchEvent(deps: DispatchDeps, orgId: string, event: string, body: unknown): Promise<string[]> {
  const hooks = await deps.webhooks.listSubscribed(orgId, event);
  const ids: string[] = [];
  for (const hook of hooks) {
    const delivery = await deps.deliveries.create(orgId, { webhookId: hook.id, event, payload: body, now: deps.now() });
    await deps.jobs.enqueue({
      orgId,
      type: "webhook.deliver",
      payload: { webhookId: hook.id, deliveryId: delivery.id, event, body },
      maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      now: deps.now(),
    });
    ids.push(delivery.id);
  }
  return ids;
}

export interface DeliverDeps {
  webhooks: ReturnType<typeof webhooksRepo>;
  deliveries: ReturnType<typeof webhookDeliveriesRepo>;
  keyring: Keyring;
  fetch: SafeFetchDeps; // { resolve, fetchImpl } — SSRF-guarded
  now: () => number;
}

export interface DeliverPayload {
  webhookId: string;
  deliveryId: string;
  event: string;
  body: unknown;
}

/** Deliver one webhook event. Throws on failure (the jobs queue retries). */
export async function deliverWebhook(deps: DeliverDeps, orgId: string, p: DeliverPayload): Promise<void> {
  const hook = await deps.webhooks.getInOrg(orgId, p.webhookId);
  if (!hook || !hook.isActive) return; // deleted/disabled mid-flight → drop, no retry

  const secret = decryptSecret(hook.secretCiphertext, deps.keyring, secretAad(orgId, p.webhookId));
  const raw = JSON.stringify({ event: p.event, data: p.body });
  const tsSec = Math.floor(deps.now() / 1000);
  const signature = buildSignatureHeader(secret, raw, tsSec);

  const bump = async (patch: Parameters<typeof deps.deliveries.update>[2]) =>
    deps.deliveries.update(orgId, p.deliveryId, patch);

  let res: Response;
  try {
    res = await guardedFetch(deps.fetch, hook.url, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signature, "EvalDesk-Event": p.event },
      body: raw,
      redirect: "manual",
    });
  } catch (e) {
    await bump({ status: "failed", attempts: 0, lastError: (e as Error).message, updatedAt: deps.now() });
    throw e; // queue retries with backoff
  }

  if (res.status >= 200 && res.status < 300) {
    await bump({ status: "delivered", responseStatus: res.status, updatedAt: deps.now() });
    return;
  }
  await bump({ status: "failed", responseStatus: res.status, lastError: `HTTP ${res.status}`, updatedAt: deps.now() });
  throw new Error(`webhook delivery failed: HTTP ${res.status}`);
}
