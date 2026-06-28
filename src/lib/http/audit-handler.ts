import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

/** GET /audit — the org's tamper-evident audit log (newest-first). */
export async function handleListAudit(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const url = new URL(req.url);
    const limit = url.searchParams.has("limit") ? Math.min(Number(url.searchParams.get("limit")), 500) : 100;
    const beforeSeq = url.searchParams.has("beforeSeq") ? Number(url.searchParams.get("beforeSeq")) : undefined;
    const events = await c.audit.list(getSessionToken(req), o.orgId, { limit, beforeSeq });
    return json({ events });
  } catch (e) {
    return errorResponse(e);
  }
}
