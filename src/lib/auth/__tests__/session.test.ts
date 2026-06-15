import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { sessionsRepo } from "@/db/repos/sessions";
import { sessionService } from "@/lib/auth/session";

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup(nowRef: { v: number }) {
  tdb = await makeSqliteTestDb();
  const users = usersRepo(tdb.db, tdb.schema);
  const user = await users.create({ name: "U", email: "u@a.test", now: nowRef.v });
  const svc = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now: () => nowRef.v });
  return { svc, user };
}

describe("sessionService", () => {
  it("creates a session and validates the issued token", async () => {
    const clock = { v: 1000 };
    const { svc, user } = await setup(clock);
    const { token, session } = await svc.create({ userId: user.id });

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(session.userId).toBe(user.id);

    const valid = await svc.validate(token);
    expect(valid?.id).toBe(session.id);
  });

  it("rejects an unknown / tampered token", async () => {
    const clock = { v: 1000 };
    const { svc, user } = await setup(clock);
    const { token } = await svc.create({ userId: user.id });

    expect(await svc.validate("not-a-real-token")).toBeNull();
    expect(await svc.validate(token + "x")).toBeNull(); // tampered hash misses
    expect(await svc.validate("")).toBeNull();
  });

  it("rejects an expired session", async () => {
    const clock = { v: 1000 };
    const { svc, user } = await setup(clock);
    const { token } = await svc.create({ userId: user.id, ttlMs: 5000 });

    clock.v = 1000 + 4999;
    expect(await svc.validate(token)).not.toBeNull(); // still valid
    clock.v = 1000 + 5000;
    expect(await svc.validate(token)).toBeNull(); // expired at boundary
  });

  it("rejects a revoked session", async () => {
    const clock = { v: 1000 };
    const { svc, user } = await setup(clock);
    const { token } = await svc.create({ userId: user.id });

    expect(await svc.validate(token)).not.toBeNull();
    await svc.revoke(token);
    expect(await svc.validate(token)).toBeNull();
  });

  it("can switch the active org on a session", async () => {
    const clock = { v: 1000 };
    const { svc, user } = await setup(clock);
    const { token } = await svc.create({ userId: user.id, orgId: null });
    await svc.setActiveOrg(token, "org-9");
    expect((await svc.validate(token))?.orgId).toBe("org-9");
  });
});
