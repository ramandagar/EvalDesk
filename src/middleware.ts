import { NextRequest, NextResponse } from "next/server";

// Presence gate ONLY — never the security boundary. Real authorization happens
// in-route via requireMember (Node runtime); the Edge middleware just checks
// that a session cookie is PRESENT and redirects/401s when it isn't. It uses
// the opaque `evaldesk_session` cookie (the old forgeable `evaldesk_user_id`
// cookie and the `pathname.includes(".")` bypass are both removed).

const SESSION_COOKIE = "evaldesk_session";

// Exact public paths.
const publicPaths = new Set(["/", "/login", "/forgot", "/reset", "/pricing", "/about", "/changelog", "/contact", "/terms", "/privacy", "/blog", "/api/health", "/demo"]);

// Public prefixes: marketing/docs/blog, the public certificate + embed pages,
// the health probe, the auth endpoints, and the whole versioned API (which
// self-guards in-route).
const publicPrefixes = ["/blog/", "/docs", "/certificate/", "/embed/", "/api/health", "/api/auth/", "/api/v1/", "/api/demo"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (publicPaths.has(pathname)) return NextResponse.next();
  for (const prefix of publicPrefixes) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Exclude Next internals + static asset files; everything else hits the gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|map)$).*)"],
};
