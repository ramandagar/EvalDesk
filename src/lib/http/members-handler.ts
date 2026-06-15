import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";
import type { Role } from "@/lib/auth/roles";

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

const addSchema = z.object({ email: z.string().email(), role: z.enum(["admin", "reviewer", "viewer"]) });
const roleSchema = z.object({ role: z.enum(["owner", "admin", "reviewer", "viewer"]) });

export async function handleListMembers(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const members = await c.members.list(getSessionToken(req), o.orgId);
    return json({ members });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleAddMember(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = addSchema.parse(await req.json());
    const member = await c.members.addByEmail(getSessionToken(req), o.orgId, { email: body.email, role: body.role as Role });
    return json({ member }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleUpdateMember(req: Request, c: Container, userId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = roleSchema.parse(await req.json());
    await c.members.updateRole(getSessionToken(req), o.orgId, userId, body.role as Role);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleRemoveMember(req: Request, c: Container, userId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    await c.members.remove(getSessionToken(req), o.orgId, userId);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
