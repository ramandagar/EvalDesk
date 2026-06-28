// HTTP response helpers + uniform error mapping. AuthzError carries the status
// (401/403/404) so the same throw works from any service; zod errors become
// 400; everything else is a 500 without leaking internals. 500s are logged
// (structured) with a stack so production errors are observable; 4xx are
// expected client errors and are not logged (noise + leak risk).
import { ZodError } from "zod";
import { AuthzError } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";

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
  // Unexpected server error — log it (with stack) so it's observable, but keep
  // the client response short and free of internals.
  logger.error("unhandled request error", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    name: err instanceof Error ? err.name : undefined,
  });
  const message = err instanceof Error ? err.message : "Internal error";
  return json({ error: message }, 500);
}
