import { and, eq, desc, asc, lt } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";
import { appendEvent, GENESIS_HASH, type AuditEvent } from "@/lib/audit/hash-chain";

// Tamper-evident audit log. Each row is one link in a per-org hash chain: its
// `hash` = sha256(prev_hash + canonical(event fields)). The unique (org_id, seq)
// constraint makes a concurrent append fail loudly so the chain head can be
// re-read and the next seq recomputed safely (CAS-style, like the job queue).

export type AuditEventRow = AuditEvent & { id: string };

export interface AppendAuditInput {
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: unknown;
}

function isUniqueViolation(err: unknown): boolean {
  return String(err instanceof Error ? err.message : err).toLowerCase().includes("unique");
}

export function auditEventsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.auditEvents;

  async function readHead(orgId: string): Promise<{ seq: number; hash: string } | null> {
    const [row] = await db
      .select({ seq: t.seq, hash: t.hash })
      .from(t)
      .where(eq(t.orgId, orgId))
      .orderBy(desc(t.seq))
      .limit(1);
    return (row as { seq: number; hash: string } | undefined) ?? null;
  }

  async function tryAppend(orgId: string, input: AppendAuditInput, now: number): Promise<AuditEventRow> {
    const head = await readHead(orgId);
    const prevHash = head?.hash ?? GENESIS_HASH;
    const seq = (head?.seq ?? 0) + 1;
    const event = appendEvent(prevHash, {
      seq,
      orgId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details,
      createdAt: now,
    });
    const [row] = await db
      .insert(t)
      .values({
        orgId,
        seq,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        details: input.details,
        prevHash: event.prevHash,
        hash: event.hash,
        createdAt: now,
      })
      .returning();
    return row as AuditEventRow;
  }

  return {
    /** Append one event to the org's chain. Retries once on a concurrent seq collision. */
    async append(orgId: string, input: AppendAuditInput, now: number): Promise<AuditEventRow> {
      try {
        return await tryAppend(orgId, input, now);
      } catch (err) {
        if (isUniqueViolation(err)) {
          // a concurrent append took our seq — re-read the head and retry once
          return await tryAppend(orgId, input, now);
        }
        throw err;
      }
    },

    /** Newest-first list for the audit viewer (cursor pagination by seq). */
    async listForOrg(orgId: string, opts: { limit?: number; beforeSeq?: number } = {}): Promise<AuditEventRow[]> {
      const limit = opts.limit ?? 100;
      const conds = [eq(t.orgId, orgId)];
      if (opts.beforeSeq != null) conds.push(lt(t.seq, opts.beforeSeq));
      const rows = await db.select().from(t).where(and(...conds)).orderBy(desc(t.seq)).limit(limit);
      return rows as AuditEventRow[];
    },

    /** Full chain oldest-first, for integrity verification (verifyChain). */
    async getChainForOrg(orgId: string): Promise<AuditEventRow[]> {
      const rows = await db.select().from(t).where(eq(t.orgId, orgId)).orderBy(asc(t.seq));
      return rows as AuditEventRow[];
    },
  };
}
