import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { apiKeysRepo } from "@/db/repos/api-keys";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { guard, AuthzError } from "@/lib/auth/guard";

const fakeHasher: PasswordHasher = {
  hash: async (pw) => `h:${pw}`,
  compare: async (pw, hash) => hash === `h:${pw}`,
};

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const users = usersRepo(tdb.db, tdb.schema);
  const memberships = membershipsRepo(tdb.db, tdb.schema);
  const orgs = organizationsRepo(tdb.db, tdb.schema);
  const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now: () => 1000 });
  const auth = authService({ users, memberships, orgs, sessions, hasher: fakeHasher, now: () => 1000 });
  const g = guard({ sessions, memberships, users, apiKeys: apiKeysRepo(tdb.db, tdb.schema), now: () => 1000 });

  const a = await auth.signup({ email: "a@x.test", password: "supersecret" }); // owner of orgA
  const b = await auth.signup({ email: "b@x.test", password: "supersecret" }); // owner of orgB
  return { g, memberships, auth, a, b };
}

describe("guard.requireMember", () => {
  it("401 when no/invalid token", async () => {
    const { g, a } = await setup();
    await expect(g.requireMember(undefined, a.org.id, "project:read")).rejects.toMatchObject({
      status: 401,
    });
    await expect(g.requireMember("garbage", a.org.id, "project:read")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("grants an owner the capability and returns context", async () => {
    const { g, a } = await setup();
    const ctx = await g.requireMember(a.token, a.org.id, "project:write");
    expect(ctx.role).toBe("owner");
    expect(ctx.user.id).toBe(a.user.id);
    expect(ctx.orgId).toBe(a.org.id);
  });

  it("404 (NOT 403) when accessing another org you don't belong to", async () => {
    const { g, a, b } = await setup();
    // user A holds a valid session but is not a member of org B.
    await expect(g.requireMember(a.token, b.org.id, "project:read")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("403 when a member lacks the capability", async () => {
    const { g, memberships, auth, a } = await setup();
    const viewer = await auth.signup({ email: "v@x.test", password: "supersecret" });
    // make the viewer-user a viewer within org A
    await memberships.create({ orgId: a.org.id, userId: viewer.user.id, role: "viewer", now: 1000 });

    await expect(g.requireMember(viewer.token, a.org.id, "project:write")).rejects.toMatchObject({
      status: 403,
    });
    // but a read capability is allowed
    const ctx = await g.requireMember(viewer.token, a.org.id, "project:read");
    expect(ctx.role).toBe("viewer");
  });
});

describe("guard.assertInOrg", () => {
  it("returns resources in the caller's org, 404s anything else", async () => {
    const { g, a, b } = await setup();
    const ctx = await g.requireMember(a.token, a.org.id, "project:read");

    expect(g.assertInOrg({ orgId: a.org.id, id: "p1" }, ctx)).toEqual({ orgId: a.org.id, id: "p1" });
    expect(() => g.assertInOrg({ orgId: b.org.id, id: "p2" }, ctx)).toThrow(AuthzError);
    expect(() => g.assertInOrg(null, ctx)).toThrow(AuthzError);
    try {
      g.assertInOrg({ orgId: b.org.id }, ctx);
    } catch (e) {
      expect((e as AuthzError).status).toBe(404);
    }
  });
});
