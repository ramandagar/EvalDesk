import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  input: z.string().min(1).max(20000),
  expectedOutput: z.string().max(20000).nullish(),
  category: z.string().max(100).nullish(),
  order: z.number().int().optional(),
});

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

export async function handleListTestCases(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) return json({ error: "projectId query param required" }, 400);
    const testCases = await c.testCases.listForProject(getSessionToken(req), o.orgId, projectId);
    return json({ testCases });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleCreateTestCase(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = createSchema.parse(await req.json());
    const testCase = await c.testCases.create(getSessionToken(req), o.orgId, body);
    return json({ testCase }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleGetTestCase(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const testCase = await c.testCases.get(getSessionToken(req), o.orgId, id);
    return json({ testCase });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleDeleteTestCase(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    await c.testCases.remove(getSessionToken(req), o.orgId, id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
