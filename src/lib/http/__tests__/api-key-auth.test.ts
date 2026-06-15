import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { buildContainer, type Container } from "@/lib/http/container";
import { handleAuth } from "@/lib/http/auth-handler";
import { handleListProjects, handleCreateProject } from "@/lib/http/projects-handler";
import { handleCreateApiKey } from "@/lib/http/api-keys-handler";
import { apiKeysRepo } from "@/db/repos/api-keys";
import { hashToken } from "@/lib/crypto/tokens";
import type { Keyring } from "@/lib/crypto/secrets";

const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 5) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
  tdb = await makeSqliteTestDb();
  const c = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1000 });
  const signup = await handleAuth(
    new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a@x.test", password: "supersecret", action: "signup" }) }),
    c,
  );
  const sessionToken = signup.headers.get("set-cookie")!.match(/evaldesk_session=([^;]+)/)![1];
  // resolve org via /me
  const meRes = await (await import("@/lib/http/me-handler")).handleMe(new Request("http://t/api/v1/me", { headers: { cookie: `evaldesk_session=${sessionToken}` } }), c);
  const orgId = ((await meRes.json()) as { activeOrgId: string }).activeOrgId;
  return { c, sessionToken, orgId };
}

function bearer(token: string, orgId: string, body?: unknown, method = "GET"): Request {
  return new Request("http://t/api/v1/x", {
    method: body !== undefined ? "POST" : method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-org-id": orgId },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("API-key (Bearer) auth", () => {
  it("a created key authenticates the API like a session", async () => {
    const { c, sessionToken, orgId } = await setup();
    // create a key (session-auth, owner has key:manage)
    const createReq = new Request("http://t/api/v1/api-keys", { method: "POST", headers: { "content-type": "application/json", cookie: `evaldesk_session=${sessionToken}`, "x-org-id": orgId }, body: JSON.stringify({ name: "ci" }) });
    const created = await handleCreateApiKey(createReq, c);
    expect(created.status).toBe(201);
    const rawKey = ((await created.json()) as { key: { key: string } }).key.key;
    expect(rawKey).toMatch(/^evaldesk_live_/);

    // use the key as Bearer to list + create projects (no cookie at all)
    const list = await handleListProjects(bearer(rawKey, orgId), c);
    expect(list.status).toBe(200);
    const create = await handleCreateProject(bearer(rawKey, orgId, { name: "via-key" }), c);
    expect(create.status).toBe(201);
  });

  it("a revoked key is rejected (401)", async () => {
    const { c, sessionToken, orgId } = await setup();
    const created = await handleCreateApiKey(new Request("http://t/api/v1/api-keys", { method: "POST", headers: { "content-type": "application/json", cookie: `evaldesk_session=${sessionToken}`, "x-org-id": orgId }, body: JSON.stringify({ name: "ci" }) }), c);
    const rawKey = ((await created.json()) as { key: { key: string } }).key.key;

    // revoke directly
    const keys = apiKeysRepo(tdb.db, tdb.schema);
    const row = (await keys.listForOrg(orgId)).find((k) => k.keyHash === hashToken(rawKey))!;
    await keys.revoke(orgId, row.id, 2000);

    const res = await handleListProjects(bearer(rawKey, orgId), c);
    expect(res.status).toBe(401);
  });

  it("a key used against another org returns 404 (no enumeration)", async () => {
    const { c, sessionToken, orgId } = await setup();
    const created = await handleCreateApiKey(new Request("http://t/api/v1/api-keys", { method: "POST", headers: { "content-type": "application/json", cookie: `evaldesk_session=${sessionToken}`, "x-org-id": orgId }, body: JSON.stringify({ name: "ci" }) }), c);
    const rawKey = ((await created.json()) as { key: { key: string } }).key.key;
    const res = await handleListProjects(bearer(rawKey, "org_someone_else"), c);
    expect(res.status).toBe(404);
  });

  it("a bogus bearer token is 401", async () => {
    const { c, orgId } = await setup();
    const res = await handleListProjects(bearer("evaldesk_live_deadbeef", orgId), c);
    expect(res.status).toBe(401);
  });

  it("a key cannot exceed its scopes (default scopes exclude key:manage → 403 on key mgmt)", async () => {
    const { c, sessionToken, orgId } = await setup();
    const created = await handleCreateApiKey(new Request("http://t/api/v1/api-keys", { method: "POST", headers: { "content-type": "application/json", cookie: `evaldesk_session=${sessionToken}`, "x-org-id": orgId }, body: JSON.stringify({ name: "ci" }) }), c);
    const rawKey = ((await created.json()) as { key: { key: string } }).key.key;
    // try to create another key USING the api key → key:manage not in default scopes → 403
    const res = await handleCreateApiKey(bearer(rawKey, orgId, { name: "nested" }), c);
    expect(res.status).toBe(403);
  });
});
