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
  name: z.string().min(1).max(120),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.number().int().positive().nullish(),
});

/** GET /api-keys — list the org's keys (hash never returned). */
export async function handleListApiKeys(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const keys = await c.apiKeys.list(getSessionToken(req), o.orgId);
    return json({ keys });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api-keys — create a key; the raw key is returned ONCE. */
export async function handleCreateApiKey(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = createSchema.parse(await req.json());
    const key = await c.apiKeys.create(getSessionToken(req), o.orgId, {
      name: body.name,
      scopes: body.scopes as never,
      expiresAt: body.expiresAt ?? null,
    });
    return json({ key }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api-keys/:id — revoke a key. */
export async function handleRevokeApiKey(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    await c.apiKeys.revoke(getSessionToken(req), o.orgId, id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
