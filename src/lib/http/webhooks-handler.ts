import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

const createSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.string().max(64)).min(1).max(20),
  projectId: z.string().max(64).optional(),
});

/** GET /webhooks — list the org's registered webhooks (secret never returned). */
export async function handleListWebhooks(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const webhooks = await c.webhooks.list(getSessionToken(req), o.orgId);
    return json({ webhooks });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /webhooks — register a webhook; the signing secret is returned ONCE. */
export async function handleCreateWebhook(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = createSchema.parse(await req.json());
    const webhook = await c.webhooks.create(getSessionToken(req), o.orgId, body);
    return json({ webhook }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
