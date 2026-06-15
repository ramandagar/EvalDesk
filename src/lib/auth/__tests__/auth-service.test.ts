import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { sessionService } from "@/lib/auth/session";
import { authService, AuthError, type PasswordHasher } from "@/lib/auth/auth-service";

// Fast deterministic hasher — never use bcrypt in unit tests.
const fakeHasher: PasswordHasher = {
  hash: async (pw) => `h:${pw}`,
  compare: async (pw, hash) => hash === `h:${pw}`,
};

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function makeAuth(now = 1000) {
  tdb = await makeSqliteTestDb();
  const users = usersRepo(tdb.db, tdb.schema);
  const memberships = membershipsRepo(tdb.db, tdb.schema);
  const orgs = organizationsRepo(tdb.db, tdb.schema);
  const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now: () => now });
  const auth = authService({
    users,
    memberships,
    orgs,
    sessions,
    hasher: fakeHasher,
    now: () => now,
  });
  return { auth, users, memberships, orgs, sessions };
}

describe("authService.signup", () => {
  it("provisions user + personal org + owner membership + session", async () => {
    const { auth, memberships, sessions } = await makeAuth();
    const { user, org, token } = await auth.signup({
      name: "Dr Acme",
      email: "Dr@Acme.TEST",
      password: "supersecret",
    });

    expect(user.email).toBe("dr@acme.test"); // normalized
    expect(user.passwordHash).toBe("h:supersecret"); // hashed, never plaintext
    const m = await memberships.get(org.id, user.id);
    expect(m?.role).toBe("owner");
    expect(m?.acceptedAt).toBe(1000);
    // the returned token is a live session scoped to the new org
    const session = await sessions.validate(token);
    expect(session?.userId).toBe(user.id);
    expect(session?.orgId).toBe(org.id);
  });

  it("rejects short passwords and duplicate emails", async () => {
    const { auth } = await makeAuth();
    await expect(auth.signup({ email: "a@b.test", password: "short" })).rejects.toBeInstanceOf(
      AuthError,
    );
    await auth.signup({ email: "dup@b.test", password: "supersecret" });
    await expect(
      auth.signup({ email: "dup@b.test", password: "supersecret" }),
    ).rejects.toThrow(/already registered/);
  });

  it("defaults the name from the email local-part", async () => {
    const { auth } = await makeAuth();
    const { user } = await auth.signup({ email: "solo@clinic.test", password: "supersecret" });
    expect(user.name).toBe("solo");
  });
});

describe("authService.login / logout", () => {
  it("logs in with correct credentials and opens an org-scoped session", async () => {
    const { auth } = await makeAuth();
    const created = await auth.signup({ email: "u@a.test", password: "supersecret" });
    const { user, token, orgId } = await auth.login({ email: "U@A.test", password: "supersecret" });
    expect(user.id).toBe(created.user.id);
    expect(orgId).toBe(created.org.id);
    expect(token).toBeTruthy();
  });

  it("rejects wrong password and unknown user with the same generic error", async () => {
    const { auth } = await makeAuth();
    await auth.signup({ email: "u@a.test", password: "supersecret" });
    await expect(auth.login({ email: "u@a.test", password: "wrong" })).rejects.toThrow(
      "Invalid email or password",
    );
    await expect(auth.login({ email: "ghost@a.test", password: "whatever" })).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("logout revokes the session token", async () => {
    const { auth, sessions } = await makeAuth();
    const { token } = await auth.signup({ email: "u@a.test", password: "supersecret" });
    expect(await sessions.validate(token)).not.toBeNull();
    await auth.logout(token);
    expect(await sessions.validate(token)).toBeNull();
  });
});
