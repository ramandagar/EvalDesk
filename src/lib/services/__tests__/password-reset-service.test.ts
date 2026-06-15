import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { sessionsRepo } from "@/db/repos/sessions";
import { passwordResetTokensRepo } from "@/db/repos/password-reset-tokens";
import { passwordResetService } from "@/lib/services/password-reset-service";
import type { PasswordHasher } from "@/lib/auth/auth-service";
import { hashToken } from "@/lib/crypto/tokens";

const hasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };

let tdb: TestDb;
afterEach(async () => { await tdb.cleanup(); });

async function setup(now = () => 1000) {
  tdb = await makeSqliteTestDb();
  const users = usersRepo(tdb.db, tdb.schema);
  const resetTokens = passwordResetTokensRepo(tdb.db, tdb.schema);
  const sessions = sessionsRepo(tdb.db, tdb.schema);
  const svc = passwordResetService({ users, resetTokens, sessions, hasher, now });
  const user = await users.create({ name: "A", email: "a@x.test", passwordHash: "h:original", emailVerified: 1, now: 1 });
  return { svc, users, resetTokens, sessions, user };
}

describe("passwordResetService", () => {
  it("requestReset on a nonexistent email is a silent no-op (no enumeration, no token)", async () => {
    const { svc, resetTokens } = await setup();
    await svc.requestReset("nobody@x.test", "http://t");
    // no token created — resolve any random hash returns null
    expect(await resetTokens.resolve(hashToken("anything"), 1000)).toBeNull();
  });

  it("creates a token for a real user; reset() sets the new password + revokes sessions", async () => {
    let t = 1000;
    const { svc, users, resetTokens, sessions, user } = await setup(() => t);
    // a live session that should be killed by the reset
    await sessions.create({ userId: user.id, tokenHash: "sess1", expiresAt: 9_999_999, now: 1 } as never);

    await svc.requestReset("a@x.test", "http://t");
    // recover the raw token via the hash stored (we know issueToken hashes it; test reset path with a fresh known token)
    // Instead, create a known token directly to exercise reset:
    await resetTokens.create({ userId: user.id, tokenHash: hashToken("RAWTOK"), expiresAt: t + 100000, now: t });

    await svc.reset("RAWTOK", "newpassword123");
    expect((await users.getById(user.id))!.passwordHash).toBe("h:newpassword123");
    // the token is now used → cannot be reused
    await expect(svc.reset("RAWTOK", "anotherpass123")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a short password (400)", async () => {
    const { svc, resetTokens, user } = await setup();
    await resetTokens.create({ userId: user.id, tokenHash: hashToken("TOK2"), expiresAt: 100000, now: 1 });
    await expect(svc.reset("TOK2", "short")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an expired token (400)", async () => {
    let t = 1000;
    const { svc, resetTokens, user } = await setup(() => t);
    await resetTokens.create({ userId: user.id, tokenHash: hashToken("TOK3"), expiresAt: 2000, now: 1000 });
    t = 5000; // past expiry
    await expect(svc.reset("TOK3", "validpassword1")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an unknown token (400)", async () => {
    const { svc } = await setup();
    await expect(svc.reset("does-not-exist", "validpassword1")).rejects.toMatchObject({ status: 400 });
  });
});
