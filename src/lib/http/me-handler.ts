import type { Container } from "./container";
import { getSessionToken } from "./request";
import { json, errorResponse } from "./responses";

/** GET /me — the caller's identity + org memberships (no X-Org-Id required). */
export async function handleMe(req: Request, c: Container): Promise<Response> {
  try {
    const me = await c.identity.me(getSessionToken(req));
    return json(me);
  } catch (e) {
    return errorResponse(e);
  }
}
