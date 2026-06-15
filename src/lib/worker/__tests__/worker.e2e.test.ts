import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { runResultsRepo } from "@/db/repos/run-results";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer } from "@/lib/http/container";
import { buildWorkerContext } from "@/lib/worker/context";
import { drainWorker } from "@/lib/worker/worker";
import type { Keyring } from "@/lib/crypto/secrets";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 4) } };

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

describe("async run pipeline (API → queue → worker → executor)", () => {
  it("drains a run.execute job and stores scored results end-to-end", async () => {
    tdb = await makeSqliteTestDb();
    const now = () => 1000;
    const sessions = sessionService({ sessions: sessionsRepo(tdb.db, tdb.schema), now });
    const auth = authService({
      users: usersRepo(tdb.db, tdb.schema),
      memberships: membershipsRepo(tdb.db, tdb.schema),
      orgs: organizationsRepo(tdb.db, tdb.schema),
      sessions,
      hasher: fakeHasher,
      now,
    });
    const api = buildContainer({ db: tdb.db, schema: tdb.schema, keyring, now });

    const a = await auth.signup({ email: "a@x.test", password: "supersecret" });

    // project with an agent endpoint + a stored (encrypted) API key
    const project = await api.projects.create(a.token, a.org.id, {
      name: "Triage",
      agentEndpoint: "https://agent.test/chat",
      agentType: "custom",
      agentApiKey: "sk-agent-secret",
    });
    await api.testCases.create(a.token, a.org.id, { projectId: project.id, title: "1", input: "chest pain" });
    await api.testCases.create(a.token, a.org.id, { projectId: project.id, title: "2", input: "headache" });

    // create a run (enqueues a job)
    const run = await api.runs.create(a.token, a.org.id, project.id);
    expect(run.status).toBe("queued");

    // fake agent: echoes, and asserts the decrypted key reached it
    let sawAuth: string | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sawAuth = (init.headers as Record<string, string>).Authorization;
      return new Response(JSON.stringify({ response: "handled" }), { status: 200 });
    }) as unknown as typeof fetch;

    const worker = buildWorkerContext({ db: tdb.db, schema: tdb.schema, keyring, fetchImpl, now });
    const processed = await drainWorker(worker);
    expect(processed).toBe(1);

    // the worker decrypted the stored key and sent it to the agent
    expect(sawAuth).toBe("Bearer sk-agent-secret");

    // run finalized + results stored
    const finalized = await api.runs.get(a.token, a.org.id, run.id);
    expect(finalized.status).toBe("completed");
    expect(finalized.totalCases).toBe(2);

    const results = await runResultsRepo(tdb.db, tdb.schema).listForRun(a.org.id, run.id);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.agentResponse === "handled")).toBe(true);
    expect(results.every((r) => r.status === "completed")).toBe(true);
    expect(results.every((r) => r.needsHuman)).toBe(true);
  });
});
