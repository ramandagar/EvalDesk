import { describe, it, expect, afterEach } from "vitest";
import { makeSqliteTestDb, type TestDb } from "../../../../tests/helpers/db";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { organizationsRepo } from "@/db/repos/organizations";
import { sessionsRepo } from "@/db/repos/sessions";
import { runResultsRepo } from "@/db/repos/run-results";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import { sessionService } from "@/lib/auth/session";
import { authService, type PasswordHasher } from "@/lib/auth/auth-service";
import { buildContainer } from "@/lib/http/container";
import { buildWorkerContext } from "@/lib/worker/context";
import { drainWorker } from "@/lib/worker/worker";
import type { Keyring } from "@/lib/crypto/secrets";
import type { Provider, CompletionRequest, CompletionResult } from "@/lib/ai/provider";
import type { JudgeConfig } from "@/lib/worker/handlers";

const fakeHasher: PasswordHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };
const keyring: Keyring = { activeKeyId: "k1", keys: { k1: Buffer.alloc(32, 7) } };

/** Judge that answers per model so we can script agreement/disagreement. */
class JudgeProvider implements Provider {
  readonly name = "fake-judge";
  constructor(private byModel: Record<string, { rating: string; score: number }>) {}
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const v = this.byModel[req.model] ?? { rating: "partial", score: 50 };
    return { text: `RATING: ${v.rating}\nSCORE: ${v.score}\nREASONING: scored ${req.model}`, model: req.model };
  }
}

let tdb: TestDb;
afterEach(async () => {
  await tdb.cleanup();
});

async function setup() {
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
  const project = await api.projects.create(a.token, a.org.id, {
    name: "Triage",
    agentEndpoint: "https://agent.test/chat",
    agentType: "custom",
    agentApiKey: "sk-agent-secret",
  });
  await api.testCases.create(a.token, a.org.id, { projectId: project.id, title: "1", input: "chest pain", expectedOutput: "ER" });
  await api.testCases.create(a.token, a.org.id, { projectId: project.id, title: "2", input: "headache", expectedOutput: "rest" });
  const run = await api.runs.create(a.token, a.org.id, project.id);

  const agentFetch = (async () => new Response(JSON.stringify({ response: "handled" }), { status: 200 })) as unknown as typeof fetch;
  return { now, api, a, project, run, agentFetch };
}

async function drainWithJudge(judge: JudgeConfig, ctx: Awaited<ReturnType<typeof setup>>) {
  const worker = buildWorkerContext({
    db: tdb.db,
    schema: tdb.schema,
    keyring,
    fetchImpl: ctx.agentFetch,
    now: ctx.now,
    judge,
  });
  return drainWorker(worker);
}

describe("async judge pipeline (execute → judge → ai_scores + routing)", () => {
  it("two agreeing distinct judges → ai_scores persisted, auto-finalized, counters set", async () => {
    const ctx = await setup();
    const provider = new JudgeProvider({ "gpt-4o": { rating: "pass", score: 92 }, "claude-x": { rating: "pass", score: 88 } });
    const processed = await drainWithJudge(
      { provider, specs: [{ model: "gpt-4o" }, { model: "claude-x" }], auditRate: 0 },
      ctx,
    );
    expect(processed).toBe(3); // run.execute + run.judge + calibration.recompute

    const scores = aiScoresRepo(tdb.db, tdb.schema);
    const results = await runResultsRepo(tdb.db, tdb.schema).listForRun(ctx.a.org.id, ctx.run.id);
    expect(results).toHaveLength(2);

    // two distinct judges → two immutable ai_scores per result
    for (const r of results) {
      const rs = await scores.listForResult(ctx.a.org.id, r.id);
      expect(rs.map((s) => s.model).sort()).toEqual(["claude-x", "gpt-4o"]);
      expect(rs.every((s) => s.label === "pass")).toBe(true);
      expect(rs.every((s) => s.disagreement === 0)).toBe(true);
      expect(rs.every((s) => typeof s.confidence === "number")).toBe(true);
    }
    // agreeing + confident + not audited → auto-finalized, no human needed
    expect(results.every((r) => r.needsHuman === false)).toBe(true);

    const finalized = await ctx.api.runs.get(ctx.a.token, ctx.a.org.id, ctx.run.id);
    expect(finalized.status).toBe("completed");
    expect(finalized.passCount).toBe(2);
    expect(finalized.unratedCount).toBe(0);
    expect(finalized.passRate).toBe(100);

    // calibration.recompute ran: a cold-start (unpublished, no human pairs) row exists
    const cal = await judgeCalibrationRepo(tdb.db, tdb.schema).getLatest(ctx.a.org.id, ctx.project.id, "ensemble");
    expect(cal).not.toBeNull();
    expect(cal!.published).toBe(false);
    expect(cal!.tau).toBeNull();
    expect(cal!.sampleN).toBe(0); // no human verdicts yet → no pairs
  });

  it("two judges that split pass/fail → disagreement routes every result to a human", async () => {
    const ctx = await setup();
    const provider = new JudgeProvider({ "gpt-4o": { rating: "pass", score: 95 }, "claude-x": { rating: "fail", score: 5 } });
    await drainWithJudge({ provider, specs: [{ model: "gpt-4o" }, { model: "claude-x" }], auditRate: 0 }, ctx);

    const results = await runResultsRepo(tdb.db, tdb.schema).listForRun(ctx.a.org.id, ctx.run.id);
    expect(results.every((r) => r.needsHuman === true)).toBe(true);
    const finalized = await ctx.api.runs.get(ctx.a.token, ctx.a.org.id, ctx.run.id);
    expect(finalized.unratedCount).toBe(2);
    expect(finalized.passCount).toBe(0);
    expect(finalized.passRate).toBeNull(); // nothing auto-finalized
  });

  it("single judge is not trusted by default → routes to human (single-judge)", async () => {
    const ctx = await setup();
    const provider = new JudgeProvider({ "gpt-4o": { rating: "pass", score: 90 } });
    await drainWithJudge({ provider, specs: [{ model: "gpt-4o" }], auditRate: 0 }, ctx);

    const scores = aiScoresRepo(tdb.db, tdb.schema);
    const results = await runResultsRepo(tdb.db, tdb.schema).listForRun(ctx.a.org.id, ctx.run.id);
    for (const r of results) {
      expect(await scores.listForResult(ctx.a.org.id, r.id)).toHaveLength(1); // one judge → one score
      expect(r.needsHuman).toBe(true);
    }
  });

  it("audit sample forces human review even when judges agree confidently", async () => {
    const ctx = await setup();
    const provider = new JudgeProvider({ "gpt-4o": { rating: "pass", score: 92 }, "claude-x": { rating: "pass", score: 90 } });
    await drainWithJudge({ provider, specs: [{ model: "gpt-4o" }, { model: "claude-x" }], auditRate: 1 }, ctx);
    const results = await runResultsRepo(tdb.db, tdb.schema).listForRun(ctx.a.org.id, ctx.run.id);
    expect(results.every((r) => r.needsHuman === true)).toBe(true); // 100% audit
  });

  it("re-running the judge job is idempotent (no duplicate ai_scores)", async () => {
    const ctx = await setup();
    const provider = new JudgeProvider({ "gpt-4o": { rating: "pass", score: 92 }, "claude-x": { rating: "pass", score: 88 } });
    const judge: JudgeConfig = { provider, specs: [{ model: "gpt-4o" }, { model: "claude-x" }], auditRate: 0 };
    await drainWithJudge(judge, ctx);

    // manually enqueue + drain another run.judge for the same run
    const worker = buildWorkerContext({ db: tdb.db, schema: tdb.schema, keyring, fetchImpl: ctx.agentFetch, now: ctx.now, judge });
    await worker.jobs.enqueue({ orgId: ctx.a.org.id, type: "run.judge", payload: { runId: ctx.run.id, projectId: ctx.project.id }, now: ctx.now() });
    await drainWorker(worker);

    const scores = aiScoresRepo(tdb.db, tdb.schema);
    const results = await runResultsRepo(tdb.db, tdb.schema).listForRun(ctx.a.org.id, ctx.run.id);
    for (const r of results) {
      // still exactly two — the second judge pass did not double-write
      expect(await scores.listForResult(ctx.a.org.id, r.id)).toHaveLength(2);
    }
  });
});
