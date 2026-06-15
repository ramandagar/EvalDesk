// ============================================================================
// Password reset. requestReset is always "success" to the caller (no account
// enumeration); if the email matches a user, a single-use, 1-hour, hash-stored
// token is created and emailed. reset() validates the token, sets the new
// password, marks the token used, and revokes the user's existing sessions
// (so a leaked old session can't survive a reset). Kept separate from
// authService to avoid touching its construction sites.
// ============================================================================

import { issueToken, hashToken } from "@/lib/crypto/tokens";
import { AuthError, MIN_PASSWORD_LENGTH } from "@/lib/auth/auth-service";
import type { usersRepo } from "@/db/repos/users";
import type { passwordResetTokensRepo } from "@/db/repos/password-reset-tokens";
import type { sessionsRepo } from "@/db/repos/sessions";
import type { PasswordHasher } from "@/lib/auth/auth-service";
import { resolveEmailSender } from "@/lib/email/sender";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface PasswordResetServiceDeps {
  users: ReturnType<typeof usersRepo>;
  resetTokens: ReturnType<typeof passwordResetTokensRepo>;
  sessions: ReturnType<typeof sessionsRepo>;
  hasher: PasswordHasher;
  now: () => number;
}

export function passwordResetService(deps: PasswordResetServiceDeps) {
  return {
    /** Always returns void (no enumeration). Emails a reset link if the user exists. */
    async requestReset(email: string, baseUrl: string): Promise<void> {
      const user = await deps.users.getByEmail(email.trim().toLowerCase());
      if (!user) return; // silently succeed
      const { token, tokenHash } = issueToken(32);
      await deps.resetTokens.create({ userId: user.id, tokenHash, expiresAt: deps.now() + TOKEN_TTL_MS, now: deps.now() });
      const link = `${baseUrl.replace(/\/$/, "")}/reset?token=${token}`;
      const email_ = await resolveEmailSender();
      await email_.send({
        to: user.email,
        subject: "Reset your EvalDesk password",
        text: `Reset your password using this link (valid for 1 hour):\n\n${link}\n\nIf you didn't request this, ignore this email.`,
      });
    },

    /** Validate the token and set the new password. Throws AuthError on bad input/token. */
    async reset(rawToken: string, newPassword: string): Promise<void> {
      if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      const tok = await deps.resetTokens.resolve(hashToken(rawToken), deps.now());
      if (!tok) throw new AuthError("Invalid or expired reset link");

      const passwordHash = await deps.hasher.hash(newPassword);
      await deps.users.updatePassword(tok.userId, passwordHash);
      await deps.resetTokens.markUsed(tok.id, deps.now());
      await deps.sessions.revokeAllForUser(tok.userId, deps.now()); // invalidate old sessions
    },
  };
}
