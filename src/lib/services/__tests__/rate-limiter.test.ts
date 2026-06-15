import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { rateLimitsRepo } from "@/db/repos/rate-limits";
import { rateLimiter } from "@/lib/services/rate-limiter";

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

describe("rateLimiter (fixed-window over rate_limits)", () => {
  it("allows up to the limit, then denies within the window", async () => {
    tdb = await makeSqliteTestDb();
    let t = 1_000_000;
    const rl = rateLimiter({ rateLimits: rateLimitsRepo(tdb.db, tdb.schema), now: () => t });
    const rule = { limit: 3, windowMs: 60_000 };

    for (let i = 1; i <= 3; i++) {
      const r = await rl.check("auth:login:ip:1.2.3.4", rule);
      expect(r.allowed).toBe(true);
      expect(r.count).toBe(i);
    }
    const blocked = await rl.check("auth:login:ip:1.2.3.4", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets when the window rolls over", async () => {
    tdb = await makeSqliteTestDb();
    let t = 1_000_000;
    const rl = rateLimiter({ rateLimits: rateLimitsRepo(tdb.db, tdb.schema), now: () => t });
    const rule = { limit: 1, windowMs: 60_000 };

    expect((await rl.check("k", rule)).allowed).toBe(true);
    expect((await rl.check("k", rule)).allowed).toBe(false);
    t += 60_000; // next window
    expect((await rl.check("k", rule)).allowed).toBe(true);
  });

  it("separate buckets (different IPs) don't interfere", async () => {
    tdb = await makeSqliteTestDb();
    const rl = rateLimiter({ rateLimits: rateLimitsRepo(tdb.db, tdb.schema), now: () => 1 });
    const rule = { limit: 1, windowMs: 60_000 };
    expect((await rl.check("ip:a", rule)).allowed).toBe(true);
    expect((await rl.check("ip:b", rule)).allowed).toBe(true); // different bucket
    expect((await rl.check("ip:a", rule)).allowed).toBe(false);
  });

  it("FAILS CLOSED on a store error (denies)", async () => {
    const throwing = { increment: async () => { throw new Error("db down"); } } as unknown as ReturnType<typeof rateLimitsRepo>;
    const rl = rateLimiter({ rateLimits: throwing, now: () => 1 });
    const r = await rl.check("k", { limit: 10, windowMs: 60_000, failClosed: true });
    expect(r.allowed).toBe(false);
  });

  it("circuit breaker: after sustained store failures, fails OPEN (app not bricked)", async () => {
    const throwing = { increment: async () => { throw new Error("db down"); } } as unknown as ReturnType<typeof rateLimitsRepo>;
    const rl = rateLimiter({ rateLimits: throwing, now: () => 1 });
    const rule = { limit: 10, windowMs: 60_000, failClosed: true };
    let last = true;
    for (let i = 0; i < 6; i++) last = (await rl.check("k", rule)).allowed;
    expect(last).toBe(true); // tripped open after 5 consecutive failures
  });
});
