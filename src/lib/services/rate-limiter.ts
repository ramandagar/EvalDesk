// ============================================================================
// Rate limiter — fixed-window over the rate_limits table. Auth limiters FAIL
// CLOSED: if the store errors, the request is denied (with a circuit breaker so
// a sustained outage doesn't hard-lock the system forever — after N consecutive
// store failures it fails OPEN to keep the app usable, then re-probes). This is
// the abuse/brute-force defense on login/signup.
// ============================================================================

import type { rateLimitsRepo } from "@/db/repos/rate-limits";

export interface RateLimiterDeps {
  rateLimits: ReturnType<typeof rateLimitsRepo>;
  now: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSec: number;
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
  /** fail-closed (deny on store error) for auth; open for non-auth. */
  failClosed?: boolean;
}

export function rateLimiter(deps: RateLimiterDeps) {
  let consecutiveFailures = 0;
  const CIRCUIT_TRIP = 5; // after this many store failures in a row, fail open

  return {
    async check(bucket: string, rule: RateLimitRule): Promise<RateLimitResult> {
      const now = deps.now();
      const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
      try {
        const count = await deps.rateLimits.increment(bucket, windowStart);
        consecutiveFailures = 0;
        const allowed = count <= rule.limit;
        const retryAfterSec = allowed ? 0 : Math.ceil((windowStart + rule.windowMs - now) / 1000);
        return { allowed, count, limit: rule.limit, retryAfterSec };
      } catch {
        consecutiveFailures += 1;
        // Fail closed for auth, UNLESS the circuit has tripped (store outage) —
        // then fail open so the app isn't bricked, and keep probing.
        const failClosed = rule.failClosed !== false && consecutiveFailures < CIRCUIT_TRIP;
        return { allowed: !failClosed, count: 0, limit: rule.limit, retryAfterSec: failClosed ? 60 : 0 };
      }
    },
  };
}
