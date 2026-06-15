import { and, eq, lte, lt, sql, inArray, asc } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  orgId: string;
  type: string;
  payload: unknown | null;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: number;
  lockedAt: number | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EnqueueInput {
  orgId: string;
  type: string;
  payload?: unknown;
  now: number;
  runAfter?: number;
  maxAttempts?: number;
  id?: string;
}

/**
 * Postgres/SQLite-backed job queue. The claim uses optimistic concurrency: pick
 * candidate ids, then UPDATE ... WHERE id=? AND status='queued' RETURNING. The
 * status guard makes the claim atomic per row on BOTH engines, so two workers
 * never run the same job — no FOR UPDATE / dialect-specific SQL required.
 */
export function jobsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.jobs;

  return {
    async enqueue(input: EnqueueInput): Promise<Job> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          orgId: input.orgId,
          type: input.type,
          payload: input.payload ?? null,
          status: "queued",
          attempts: 0,
          maxAttempts: input.maxAttempts ?? 3,
          runAfter: input.runAfter ?? input.now,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();
      return row as Job;
    },

    /** Atomically claim the next due job (optionally filtered by type). */
    async claim(workerId: string, now: number, opts?: { types?: string[]; lookahead?: number }): Promise<Job | null> {
      const conds = [eq(t.status, "queued"), lte(t.runAfter, now)];
      if (opts?.types?.length) conds.push(inArray(t.type, opts.types));

      const candidates = await db
        .select({ id: t.id })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.runAfter), asc(t.createdAt))
        .limit(opts?.lookahead ?? 5);

      for (const cand of candidates) {
        const [claimed] = await db
          .update(t)
          .set({
            status: "running",
            lockedAt: now,
            lockedBy: workerId,
            attempts: sql`${t.attempts} + 1`,
            updatedAt: now,
          })
          .where(and(eq(t.id, cand.id), eq(t.status, "queued"))) // CAS guard
          .returning();
        if (claimed) return claimed as Job;
        // else another worker won the race — try the next candidate
      }
      return null;
    },

    async complete(id: string, now: number): Promise<void> {
      await db
        .update(t)
        .set({ status: "completed", lockedAt: null, lockedBy: null, updatedAt: now })
        .where(eq(t.id, id));
    },

    /** Fail a job: retry with backoff until max attempts, then dead-letter. */
    async fail(id: string, error: string, now: number, backoffMs = 0): Promise<Job | null> {
      const [job] = await db.select().from(t).where(eq(t.id, id));
      if (!job) return null;
      const dead = (job.attempts as number) >= (job.maxAttempts as number);
      const [updated] = await db
        .update(t)
        .set({
          status: dead ? "failed" : "queued",
          lastError: error,
          lockedAt: null,
          lockedBy: null,
          runAfter: dead ? (job.runAfter as number) : now + backoffMs,
          updatedAt: now,
        })
        .where(eq(t.id, id))
        .returning();
      return (updated as Job) ?? null;
    },

    async getById(id: string): Promise<Job | null> {
      const [row] = await db.select().from(t).where(eq(t.id, id));
      return (row as Job) ?? null;
    },

    /**
     * Crash recovery: a worker that hard-crashes (OOM/SIGKILL) leaves its job
     * stuck in "running". This resets any "running" job whose lock is older than
     * staleMs back to "queued" so another worker re-claims it — WITHOUT burning a
     * retry (the crashed attempt is decremented). Returns how many were reaped.
     * Run periodically by the worker. CASE is portable across SQLite + Postgres.
     */
    async reapStale(now: number, staleMs: number): Promise<number> {
      const cutoff = now - staleMs;
      const rows = await db
        .update(t)
        .set({
          status: "queued",
          lockedBy: null,
          lockedAt: null,
          attempts: sql`CASE WHEN ${t.attempts} > 0 THEN ${t.attempts} - 1 ELSE 0 END`,
          lastError: "reclaimed after stale lock",
          updatedAt: now,
        })
        .where(and(eq(t.status, "running"), lt(t.lockedAt, cutoff)))
        .returning();
      return rows.length;
    },
  };
}
