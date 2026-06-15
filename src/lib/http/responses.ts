// HTTP response helpers + uniform error mapping. AuthzError carries the status
// (401/403/404) so the same throw works from any service; zod errors become
// 400; everything else is a 500 without leaking internals.
import { ZodError } from "zod";
import { AuthzError } from "@/lib/auth/guard";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return json({ error: "Invalid input", details: err.flatten() }, 400);
  }
  // AuthzError and ApiError both expose a numeric `status`.
  if (err instanceof AuthzError) return json({ error: err.message }, err.status);
  if (err && typeof (err as { status?: unknown }).status === "number") {
    return json({ error: (err as Error).message }, (err as { status: number }).status);
  }
  const message = err instanceof Error ? err.message : "Internal error";
  // 500s should not echo arbitrary internals in production; keep it short.
  return json({ error: message }, 500);
}
