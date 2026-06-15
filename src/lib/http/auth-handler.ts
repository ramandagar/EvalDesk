import { z } from "zod";
import type { Container } from "./container";
import { SESSION_COOKIE, getSessionToken } from "./request";
import { json, errorResponse } from "./responses";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(400),
  name: z.string().max(200).optional(),
  action: z.enum(["login", "signup"]).default("login"),
});

function sessionCookie(token: string, maxAgeSec: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || req.headers.get("x-real-ip") || "unknown";
}

/** POST /api/auth/login — login or signup (by `action`); sets the session cookie. */
export async function handleAuth(req: Request, c: Container): Promise<Response> {
  try {
    const body = bodySchema.parse(await req.json());
    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent");

    // Brute-force / spam defense — fail-closed, per IP + action.
    const rule = body.action === "signup" ? { limit: 5, windowMs: 60_000 } : { limit: 10, windowMs: 60_000 };
    const rl = await c.rateLimiter.check(`auth:${body.action}:ip:${ip}`, rule);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Too many attempts — try again shortly" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(rl.retryAfterSec || 60) },
      });
    }

    const result =
      body.action === "signup"
        ? await c.auth.signup({ email: body.email, password: body.password, name: body.name, ip, userAgent })
        : await c.auth.login({ email: body.email, password: body.password, ip, userAgent });

    const res = json({ user: { id: result.user.id, email: result.user.email } });
    res.headers.append("set-cookie", sessionCookie(result.token, 30 * 24 * 60 * 60));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(1).max(400) });

/** POST /api/auth/forgot — email a reset link. Always 200 (no account enumeration). */
export async function handleForgotPassword(req: Request, c: Container): Promise<Response> {
  try {
    const body = forgotSchema.parse(await req.json());
    const ip = clientIp(req);
    const rl = await c.rateLimiter.check(`auth:forgot:ip:${ip}`, { limit: 5, windowMs: 60_000 });
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { "content-type": "application/json", "retry-after": String(rl.retryAfterSec || 60) } });
    const origin = new URL(req.url).origin;
    await c.passwordReset.requestReset(body.email, origin);
    return json({ ok: true }); // always success
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/auth/reset — set a new password with a valid token. */
export async function handleResetPassword(req: Request, c: Container): Promise<Response> {
  try {
    const body = resetSchema.parse(await req.json());
    await c.passwordReset.reset(body.token, body.password);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/auth/logout — revoke the session + clear the cookie. */
export async function handleLogout(req: Request, c: Container): Promise<Response> {
  try {
    const token = getSessionToken(req);
    if (token) await c.auth.logout(token);
    const res = json({ ok: true });
    res.headers.append("set-cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
