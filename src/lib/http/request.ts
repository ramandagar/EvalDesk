// Request helpers. Reads the opaque session token from the cookie and the
// active org from the X-Org-Id header. Works on the web-standard Request so the
// handlers are testable without Next internals.

export const SESSION_COOKIE = "evaldesk_session";

export function getSessionToken(req: Request): string | undefined {
  // Machine auth: Authorization: Bearer <session-token-or-api-key>. The guard
  // distinguishes an API key (evaldesk_live_ prefix) from a session token.
  const auth = req.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    const tok = auth.replace(/^Bearer\s+/i, "").trim();
    if (tok) return tok;
  }
  // Browser auth: the HttpOnly session cookie.
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === SESSION_COOKIE) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function getOrgId(req: Request): string | undefined {
  return req.headers.get("x-org-id") ?? undefined;
}
