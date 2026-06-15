import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().max(200).optional(),
});

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

export async function handleListRuns(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const projectId = new URL(req.url).searchParams.get("projectId");
    // With projectId → that project's runs; without → all runs across the org.
    const runs = projectId
      ? await c.runs.listForProject(getSessionToken(req), o.orgId, projectId)
      : await c.runs.listForOrg(getSessionToken(req), o.orgId);
    return json({ runs });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleCreateRun(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = createSchema.parse(await req.json());
    const run = await c.runs.create(getSessionToken(req), o.orgId, body.projectId, body.name);
    // 202: accepted + queued; client polls GET /runs/:id for status
    return json({ run }, 202);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleGetRun(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const run = await c.runs.get(getSessionToken(req), o.orgId, id);
    return json({ run });
  } catch (e) {
    return errorResponse(e);
  }
}
