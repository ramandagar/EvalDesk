import { describe, it, expect } from "vitest";
import { runAction, type ActionIO } from "../run-action";
import { RunHandle, type EvalDesk, type Run } from "@/sdk/typescript";

function fakeClient(run: Run): EvalDesk {
  // Minimal stand-in: runs.create returns a handle whose wait() resolves to `run`.
  const client = {
    runs: {
      create: async () => new RunHandle(client as unknown as EvalDesk, { ...run, status: "queued" }),
    },
    waitForRun: async () => run,
  } as unknown as EvalDesk;
  return client;
}

function makeIO() {
  const outputs: Record<string, string> = {};
  let summary = "";
  const logs: string[] = [];
  const io: ActionIO = {
    log: (m) => logs.push(m),
    summary: (md) => (summary += md),
    output: (k, v) => (outputs[k] = v),
  };
  return { io, get: () => ({ outputs, summary, logs }) };
}

const run = (over: Partial<Run>): Run => ({
  id: "run_1", projectId: "p", status: "completed", totalCases: 10, passCount: 8, failCount: 1, partialCount: 1, unratedCount: 0, passRate: 80, ...over,
});

describe("runAction — CI gate", () => {
  it("passes the gate, exit 0, writes outputs + a PASS summary", async () => {
    const { io, get } = makeIO();
    const res = await runAction(fakeClient(run({})), { projectId: "p", minPassRate: 0.8 }, io);
    expect(res.exitCode).toBe(0);
    expect(res.gatePassed).toBe(true);
    const { outputs, summary } = get();
    expect(outputs.run_id).toBe("run_1");
    expect(outputs.gate_passed).toBe("true");
    expect(outputs.pass_rate).toBe("0.8000");
    expect(summary).toContain("✅ PASS");
    expect(summary).toContain("80.0%");
  });

  it("fails the gate below min pass rate → exit 1 + FAIL summary with the reason", async () => {
    const { io, get } = makeIO();
    const res = await runAction(fakeClient(run({ passCount: 5, failCount: 5, partialCount: 0 })), { projectId: "p", minPassRate: 0.8 }, io);
    expect(res.exitCode).toBe(1);
    expect(res.gatePassed).toBe(false);
    expect(res.reason).toMatch(/pass rate/);
    expect(get().summary).toContain("❌ FAIL");
  });

  it("fails when failures exceed the cap", async () => {
    const { io } = makeIO();
    const res = await runAction(fakeClient(run({ failCount: 4 })), { projectId: "p", maxFailures: 2 }, io);
    expect(res.exitCode).toBe(1);
    expect(res.reason).toMatch(/failures/);
  });

  it("with no gate configured, any completed run passes (informational)", async () => {
    const { io } = makeIO();
    const res = await runAction(fakeClient(run({ passCount: 0, failCount: 10, partialCount: 0 })), { projectId: "p" }, io);
    expect(res.exitCode).toBe(0); // no baseline/threshold → never false-fails
  });
});
