import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { buildContainer, type Container } from "@/lib/http/container";
import { handleAuth, handleLogout } from "@/lib/http/auth-handler";
import { handleMe } from "@/lib/http/me-handler";
import { SESSION_COOKIE } from "@/lib/http/request";
import type { Keyring } from "@/lib/crypto/secrets";

const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 1) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

function post(body: unknown): Request {
  return new Request("http://t/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string | null {
  const sc = res.headers.get("set-cookie");
  if (!sc) return null;
  const m = sc.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

describe("auth handler — secure login/signup over the new session", () => {
  it("signup sets an httponly session cookie and the token authenticates /me", async () => {
    tdb = await makeSqliteTestDb();
    const c = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1000 });

    const res = await handleAuth(post({ email: "a@x.test", password: "supersecret", name: "A", action: "signup" }), c);
    expect(res.status).toBe(200);
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toContain(`${SESSION_COOKIE}=`);
    expect(sc).toContain("HttpOnly");
    expect(sc).toContain("SameSite=Lax");
    const token = cookieFrom(res)!;
    expect(token).toBeTruthy();

    // the issued token works against the new secure API
    const meReq = new Request("http://t/api/v1/me", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
    const me = await handleMe(meReq, c);
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe("a@x.test");
  });

  it("login with correct password works; wrong password is 400", async () => {
    tdb = await makeSqliteTestDb();
    const c = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1000 });
    await handleAuth(post({ email: "b@x.test", password: "supersecret", action: "signup" }), c);

    const ok = await handleAuth(post({ email: "b@x.test", password: "supersecret", action: "login" }), c);
    expect(ok.status).toBe(200);
    expect(cookieFrom(ok)).toBeTruthy();

    const bad = await handleAuth(post({ email: "b@x.test", password: "wrong", action: "login" }), c);
    expect(bad.status).toBe(400);
    expect(cookieFrom(bad)).toBeNull();
  });

  it("duplicate signup is rejected (400)", async () => {
    tdb = await makeSqliteTestDb();
    const c = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1000 });
    await handleAuth(post({ email: "c@x.test", password: "supersecret", action: "signup" }), c);
    const dup = await handleAuth(post({ email: "c@x.test", password: "supersecret", action: "signup" }), c);
    expect(dup.status).toBe(400);
  });

  it("logout revokes the session so the token no longer authenticates", async () => {
    tdb = await makeSqliteTestDb();
    const c = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now: () => 1000 });
    const signup = await handleAuth(post({ email: "d@x.test", password: "supersecret", action: "signup" }), c);
    const token = cookieFrom(signup)!;

    const logoutReq = new Request("http://t/api/auth/logout", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${token}` } });
    const lo = await handleLogout(logoutReq, c);
    expect(lo.status).toBe(200);
    expect(lo.headers.get("set-cookie")).toContain("Max-Age=0");

    // revoked → /me now 401
    const meReq = new Request("http://t/api/v1/me", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
    expect((await handleMe(meReq, c)).status).toBe(401);
  });
});

