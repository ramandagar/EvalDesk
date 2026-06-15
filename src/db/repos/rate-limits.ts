import { and, eq, lt, sql } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Fixed-window rate-limit counters (no Redis). One row per (bucket, window).
// `increment` is an atomic upsert that returns the new count, so concurrent
// requests can't undercount. A GC drops expired windows. Identical on both
// engines (onConflictDoUpdate is supported by sqlite-core and pg-core).

export function rateLimitsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.rateLimits;

  return {
    /** Atomically bump the counter for (bucket, windowStart); returns new count. */
    async increment(bucket: string, windowStart: number): Promise<number> {
      const [row] = await db
        .insert(t)
        .values({ bucket, windowStart, count: 1 })
        .onConflictDoUpdate({ target: [t.bucket, t.windowStart], set: { count: sql`${t.count} + 1` } })
        .returning();
      return (row as { count: number }).count;
    },

    async currentCount(bucket: string, windowStart: number): Promise<number> {
      const [row] = await db.select().from(t).where(and(eq(t.bucket, bucket), eq(t.windowStart, windowStart)));
      return row ? ((row as { count: number }).count ?? 0) : 0;
    },

    /** Garbage-collect windows older than `before` (epoch-ms). */
    async gc(before: number): Promise<void> {
      await db.delete(t).where(lt(t.windowStart, before));
    },
  };
}
