import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

const importSchema = z.object({
  projectId: z.string().min(1),
  // the raw dataset as a string (jsonl or json), format auto-detected
  data: z.string().min(1),
});

/** POST /imports — import a deepeval/langfuse/openai-evals dataset into a project. */
export async function handleImport(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = importSchema.parse(await req.json());
    const result = await c.imports.importDataset(getSessionToken(req), o.orgId, body.projectId, body.data);
    return json({ result }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
