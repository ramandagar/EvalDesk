// ============================================================================
// Audit service — thin wrapper over the audit-events repo. `record` is
// BEST-EFFORT: it never throws (a logging failure must not break a user
// mutation; the signed certificate remains the primary compliance artifact).
// `list` is the read path for the audit viewer (requires org:read).
// ============================================================================

import type { guard } from "@/lib/auth/guard";
import type { auditEventsRepo, AuditEventRow } from "@/db/repos/audit-events";
import { logger } from "@/lib/logger";

export interface AuditServiceDeps {
  guard: ReturnType<typeof guard>;
  auditEvents: ReturnType<typeof auditEventsRepo>;
  now: () => number;
}

export interface AuditActor {
  orgId: string;
  actorId: string | null;
}

export function auditService(deps: AuditServiceDeps) {
  return {
    /** Record one audit event. Never throws — logs on failure. */
    async record(actor: AuditActor, action: string, opts: { resourceType?: string | null; resourceId?: string | null; details?: unknown } = {}): Promise<void> {
      try {
        await deps.auditEvents.append(
          actor.orgId,
          {
            actorId: actor.actorId,
            action,
            resourceType: opts.resourceType ?? null,
            resourceId: opts.resourceId ?? null,
            details: opts.details ?? null,
          },
          deps.now(),
        );
      } catch (e) {
        logger.warn("audit record failed", {
          action,
          orgId: actor.orgId,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    },

    /** List audit events for the org (newest-first). Requires org:read. */
    async list(token: string | undefined, orgId: string, opts: { limit?: number; beforeSeq?: number } = {}): Promise<AuditEventRow[]> {
      await deps.guard.requireMember(token, orgId, "org:read");
      return deps.auditEvents.listForOrg(orgId, opts);
    },
  };
}
