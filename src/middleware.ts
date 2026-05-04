import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me"];
const publicPathPrefixes = ["/certificate/", "/api/certificates"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (publicPaths.includes(pathname)) return NextResponse.next();
  for (const prefix of publicPathPrefixes) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const userId = req.cookies.get("evaldesk_user_id")?.value;
  if (!userId) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    // Dashboard routes redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
