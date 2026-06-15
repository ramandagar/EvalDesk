// ============================================================================
// Session service. Issues opaque tokens (only the hash is stored), and
// validates them with expiry + revocation checks. This replaces the old
// "cookie value IS the user id" scheme — a forged/guessed cookie can no longer
// impersonate anyone, because a valid session requires an unguessable token
// whose hash exists, is unrevoked, and is unexpired.
//
// Dependency-injected (repo + clock) so it is fully unit-testable.
// ============================================================================

import { issueToken, hashToken } from "@/lib/crypto/tokens";
import type { sessionsRepo, Session } from "@/db/repos/sessions";

type SessionsRepo = ReturnType<typeof sessionsRepo>;

export interface SessionDeps {
  sessions: SessionsRepo;
  now: () => number;
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface CreateSessionArgs {
  userId: string;
  orgId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  ttlMs?: number;
}

export function sessionService(deps: SessionDeps) {
  return {
    /** Create a session; returns the raw token (shown once) + the session row. */
    async create(args: CreateSessionArgs): Promise<{ token: string; session: Session }> {
      const { token, tokenHash } = issueToken();
      const now = deps.now();
      const session = await deps.sessions.create({
        userId: args.userId,
        orgId: args.orgId ?? null,
        tokenHash,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
        expiresAt: now + (args.ttlMs ?? SESSION_TTL_MS),
        now,
      });
      return { token, session };
    },

    /** Return the session iff the token maps to a live (unrevoked, unexpired) one. */
    async validate(token: string): Promise<Session | null> {
      if (!token) return null;
      const session = await deps.sessions.getByTokenHash(hashToken(token));
      if (!session) return null;
      if (session.revokedAt != null) return null;
      if (session.expiresAt <= deps.now()) return null;
      return session;
    },

    async revoke(token: string): Promise<void> {
      const session = await deps.sessions.getByTokenHash(hashToken(token));
      if (session && session.revokedAt == null) {
        await deps.sessions.revoke(session.id, deps.now());
      }
    },

    /** Switch the org a session is acting within (org switcher). */
    async setActiveOrg(token: string, orgId: string): Promise<void> {
      const session = await deps.sessions.getByTokenHash(hashToken(token));
      if (session) await deps.sessions.setActiveOrg(session.id, orgId);
    },
  };
}
