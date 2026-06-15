import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { apiKeysRepo } from "@/db/repos/api-keys";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { projectsRepo } from "@/db/repos/projects";
import { secretsRepo } from "@/db/repos/secrets";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { guard } from "@/lib/auth/guard";
import { projectsService } from "@/lib/services/projects-service";
import { decryptSecret, type Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = {
  hash: async (pw) => `h:${pw}`,
  compare: async (pw, h) => h === `h:${pw}`,
};
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 7) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const users = usersRepo(tdb.db, tdb.schema);
  const memberships = membershipsRepo(tdb.db, tdb.schema);
  const orgs = organizationsRepo(tdb.db, tdb.schema);
  const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now: () => 100 });
  const auth = authService({ users, memberships, orgs, sessions, hasher: fakeHasher, now: () => 100 });
  const svc = projectsService({
    guard: guard({ sessions, memberships, users, apiKeys: apiKeysRepo(tdb.db, tdb.schema), now: () => 100 }),
    projects: projectsRepo(tdb.db, tdb.schema),
    secrets: secretsRepo(tdb.db, tdb.schema),
    keyring,
    now: () => 100,
  });
  const secrets = secretsRepo(tdb.db, tdb.schema);
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  const b = await auth.signup({ email: "b@x.test", password: "supersecret" });
  return { svc, auth, memberships, secrets, a, b };
}

describe("projectsService", () => {
  it("creates a project and encrypts the agent key (never returned, decryptable)", async () => {
    const { svc, secrets, a } = await setup();
    const proj = await svc.create(a.token, a.org.id, {
      name: "Triage Bot",
      agentEndpoint: "https://api.example.com",
      agentApiKey: "sk-super-secret",
    });

    // the returned object never carries the raw key
    expect((proj as unknown as Record<string, unknown>).agentApiKey).toBeUndefined();
    expect(proj.hasAgentApiKey).toBe(true);

    // the stored ciphertext decrypts back to the original (encryption is wired)
    const blob = await secrets.get(a.org.id, "project", proj.id, "agent_api_key");
    expect(blob).toBeTruthy();
    expect(blob!.startsWith("v1:")).toBe(true);
    const aad = `org:${a.org.id}:project:${proj.id}:agent_api_key`;
    expect(decryptSecret(blob!, keyring, aad)).toBe("sk-super-secret");
  });

  it("blocks cross-tenant read/update/delete with 404 (IDOR)", async () => {
    const { svc, a, b } = await setup();
    const proj = await svc.create(a.token, a.org.id, { name: "Secret Project" });

    // user B, acting in their own org, cannot reach A's project id
    await expect(svc.get(b.token, b.org.id, proj.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.update(b.token, b.org.id, proj.id, { name: "x" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(svc.remove(b.token, b.org.id, proj.id)).rejects.toMatchObject({ status: 404 });

    // and B cannot even pass A's orgId (not a member) → 404, no enumeration
    await expect(svc.get(b.token, a.org.id, proj.id)).rejects.toMatchObject({ status: 404 });
  });

  it("enforces RBAC: a viewer cannot create, but can read", async () => {
    const { svc, auth, memberships, a } = await setup();
    const viewer = await auth.signup({ email: "v@x.test", password: "supersecret" });
    await memberships.create({ orgId: a.org.id, userId: viewer.user.id, role: "viewer", now: 100 });

    await expect(
      svc.create(viewer.token, a.org.id, { name: "nope" }),
    ).rejects.toMatchObject({ status: 403 });

    const proj = await svc.create(a.token, a.org.id, { name: "Readable" });
    expect((await svc.get(viewer.token, a.org.id, proj.id)).name).toBe("Readable");
  });

  it("requires authentication (401 without a token)", async () => {
    const { svc, a } = await setup();
    await expect(svc.list(undefined, a.org.id)).rejects.toMatchObject({ status: 401 });
  });

  it("update can rotate the agent key", async () => {
    const { svc, secrets, a } = await setup();
    const proj = await svc.create(a.token, a.org.id, { name: "P", agentApiKey: "old-key" });
    await svc.update(a.token, a.org.id, proj.id, { name: "P2", agentApiKey: "new-key" });
    const blob = await secrets.get(a.org.id, "project", proj.id, "agent_api_key");
    const aad = `org:${a.org.id}:project:${proj.id}:agent_api_key`;
    expect(decryptSecret(blob!, keyring, aad)).toBe("new-key");
  });
});
