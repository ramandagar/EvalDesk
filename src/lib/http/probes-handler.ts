import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";
import { probeRequestSchema } from "@/lib/services/probes-service";

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

/** POST /projects/:id/probes { type: "jailbreak", count: 5 }
 *  → validates → enqueues adversarial.generate job → returns 202 Accepted.
 *  The actual probe generation runs async in the worker; poll GET /test-cases for results. */
export async function handleGenerateProbes(req: Request, c: Container, projectId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = probeRequestSchema.parse(await req.json());
    await c.probes.generate(getSessionToken(req), o.orgId, projectId, body.type, body.count);
    return json({ queued: true, type: body.type, count: body.count }, 202);
  } catch (e) {
    return errorResponse(e);
  }
}
