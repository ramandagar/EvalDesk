import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer, type Container } from "@/lib/http/container";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 3) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const now = () => 1;
  const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now });
  const auth = authService({
    users: usersRepo(tdb.db, tdb.schema),
    memberships: membershipsRepo(tdb.db, tdb.schema),
    orgs: organizationsRepo(tdb.db, tdb.schema),
    sessions,
    hasher: fakeHasher,
    now,
  });
  const c: Container = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const b = await auth.signup({ email: "b@x.test", password: "supersecret" });
  return { c, a, b };
}

describe("membersService", () => {
  it("list returns the owner, sorted, with isYou", async () => {
    const { c, a } = await setup();
    const members = await c.members.list(a.token, a.org.id);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
    expect(members[0].isYou).toBe(true);
  });

  it("addByEmail rejects the owner role (400)", async () => {
    const { c, a, b } = await setup();
    await expect(c.members.addByEmail(a.token, a.org.id, { email: "b@x.test", role: "owner" })).rejects.toMatchObject({ status: 400 });
  });

  it("addByEmail is 404 for an unknown email", async () => {
    const { c, a } = await setup();
    await expect(c.members.addByEmail(a.token, a.org.id, { email: "ghost@x.test", role: "viewer" })).rejects.toMatchObject({ status: 404 });
  });

  it("addByEmail is 409 when the user is already a member", async () => {
    const { c, a, b } = await setup();
    await c.members.addByEmail(a.token, a.org.id, { email: "b@x.test", role: "viewer" });
    await expect(c.members.addByEmail(a.token, a.org.id, { email: "b@x.test", role: "admin" })).rejects.toMatchObject({ status: 409 });
  });

  it("addByEmail succeeds and the new member appears in list", async () => {
    const { c, a, b } = await setup();
    const m = await c.members.addByEmail(a.token, a.org.id, { email: "b@x.test", role: "reviewer" });
    expect(m.role).toBe("reviewer");
    const members = await c.members.list(a.token, a.org.id);
    expect(members).toHaveLength(2);
    expect(members.some((x) => x.email === "b@x.test" && x.role === "reviewer")).toBe(true);
  });

  it("updateRole demoting the last owner is rejected (400)", async () => {
    const { c, a } = await setup();
    // A is the only owner — demoting to admin must fail
    await expect(c.members.updateRole(a.token, a.org.id, a.user.id, "admin")).rejects.toMatchObject({ status: 400 });
  });

  it("updateRole works for a non-last-owner member", async () => {
    const { c, a, b } = await setup();
    await c.members.addByEmail(a.token, a.org.id, { email: "b@x.test", role: "viewer" });
    await c.members.updateRole(a.token, a.org.id, b.user.id, "admin");
    const members = await c.members.list(a.token, a.org.id);
    expect(members.find((m) => m.email === "b@x.test")?.role).toBe("admin");
  });

  it("remove on the last owner is rejected (400)", async () => {
    const { c, a } = await setup();
    await expect(c.members.remove(a.token, a.org.id, a.user.id)).rejects.toMatchObject({ status: 400 });
  });

  it("remove works for a non-last-owner member", async () => {
    const { c, a, b } = await setup();
    await c.members.addByEmail(a.token, a.org.id, { email: "b@x.test", role: "viewer" });
    await c.members.remove(a.token, a.org.id, b.user.id);
    const members = await c.members.list(a.token, a.org.id);
    expect(members).toHaveLength(1);
  });

  it("a viewer cannot manage members (403 on add/update/remove)", async () => {
    const { c, a, b } = await setup();
    // add B as a viewer of A's org
    await c.members.addByEmail(a.token, a.org.id, { email: "b@x.test", role: "viewer" });
    // B (viewer) attempts member:manage operations in A's org → 403
    await expect(c.members.addByEmail(b.token, a.org.id, { email: "a@x.test", role: "viewer" })).rejects.toMatchObject({ status: 403 });
    await expect(c.members.updateRole(b.token, a.org.id, a.user.id, "admin")).rejects.toMatchObject({ status: 403 });
    await expect(c.members.remove(b.token, a.org.id, a.user.id)).rejects.toMatchObject({ status: 403 });
  });

  it("updateRole on a non-member is 404", async () => {
    const { c, a, b } = await setup();
    await expect(c.members.updateRole(a.token, a.org.id, b.user.id, "admin")).rejects.toMatchObject({ status: 404 });
  });
});
