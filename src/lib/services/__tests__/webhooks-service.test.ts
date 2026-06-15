import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { apiKeysRepo } from "@/db/repos/api-keys";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { webhooksRepo } from "@/db/repos/webhooks";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { guard } from "@/lib/auth/guard";
import { webhooksService } from "@/lib/services/webhooks-service";
import { decryptSecret, type Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 6) } };

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
  const repo = webhooksRepo(tdb.db, tdb.schema);
  const svc = webhooksService({ guard: guard({ sessions, memberships: membershipsRepo(tdb.db, tdb.schema), users: usersRepo(tdb.db, tdb.schema), apiKeys: apiKeysRepo(tdb.db, tdb.schema), now: () => 1 }), webhooks: repo, keyring, now });
  const a = await auth.signup({ email: "a@x.test", password: "supersecret" });
  return { svc, repo, a };
}

describe("webhooksService", () => {
  it("returns the signing secret ONCE on create, and never in the stored/listed shape", async () => {
    const { svc, repo, a } = await setup();
    const created = await svc.create(a.token, a.org.id, { url: "https://hooks.example.com/x", events: ["run.completed", "certificate.signed"] });
    expect(created.secret).toMatch(/^whsec_/);
    expect((created as unknown as Record<string, unknown>).secretCiphertext).toBeUndefined();

    // the stored ciphertext decrypts back to the returned secret (AAD bound to id)
    const stored = await repo.getInOrg(a.org.id, created.id);
    const aad = `webhook:${a.org.id}:${created.id}:secret`;
    expect(decryptSecret(stored!.secretCiphertext, keyring, aad)).toBe(created.secret);

    // list never exposes the secret or ciphertext
    const [listed] = await svc.list(a.token, a.org.id);
    expect((listed as unknown as Record<string, unknown>).secret).toBeUndefined();
    expect((listed as unknown as Record<string, unknown>).secretCiphertext).toBeUndefined();
    expect(listed.events).toEqual(["run.completed", "certificate.signed"]);
  });

  it("drops unknown event names and rejects an all-unknown set (400)", async () => {
    const { svc, a } = await setup();
    const created = await svc.create(a.token, a.org.id, { url: "https://hooks.example.com/x", events: ["run.completed", "made.up"] });
    expect(created.events).toEqual(["run.completed"]);
    await expect(svc.create(a.token, a.org.id, { url: "https://hooks.example.com/x", events: ["made.up"] })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a non-https / internal URL at registration (400, SSRF)", async () => {
    const { svc, a } = await setup();
    await expect(svc.create(a.token, a.org.id, { url: "http://localhost:9000/x", events: ["run.completed"] })).rejects.toMatchObject({ status: 400 });
  });

  it("denies an unauthenticated caller (401)", async () => {
    const { svc, a } = await setup();
    await expect(svc.create(undefined, a.org.id, { url: "https://h.test/x", events: ["run.completed"] })).rejects.toMatchObject({ status: 401 });
  });
});
