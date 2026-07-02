// Projects HTTP handlers — thin: parse/validate → call the service → map to a
// Response. All authorization + org-scoping lives in the service/guard. These
// handlers take a web-standard Request + a Container, so they are unit-testable
// without Next or the DB singleton.
import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  agentEndpoint: z.string().url().nullish(),
  agentMethod: z.enum(["GET", "POST", "PUT"]).optional(),
  agentType: z.string().max(40).nullish(),
  agentHeaders: z.record(z.string()).nullish(),
  defaultModel: z.string().max(100).optional(),
  agentApiKey: z.string().max(400).nullish(),
  judgeBaseUrl: z.string().url().nullish(), // any OpenAI-compatible endpoint
  judgeModel: z.string().max(100).nullish(),
  judgeApiKey: z.string().max(400).nullish(), // encrypted at rest, never returned
});

const updateSchema = createSchema.partial();

function orgOr400(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

export async function handleListProjects(req: Request, c: Container): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    // Paginated shape {data, page} when cursor/limit is requested; legacy {projects} otherwise.
    if (cursor || limitParam) {
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
      const page = await c.projects.listPage(getSessionToken(req), org.orgId, { limit, cursor });
      return json(page);
    }
    const projects = await c.projects.list(getSessionToken(req), org.orgId);
    return json({ projects });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleCreateProject(req: Request, c: Container): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const body = createSchema.parse(await req.json());
    const project = await c.projects.create(getSessionToken(req), org.orgId, body);
    return json({ project }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleGetProject(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const project = await c.projects.get(getSessionToken(req), org.orgId, id);
    return json({ project });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleUpdateProject(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const body = updateSchema.parse(await req.json());
    const project = await c.projects.update(getSessionToken(req), org.orgId, id, body);
    return json({ project });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleDeleteProject(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    await c.projects.remove(getSessionToken(req), org.orgId, id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
