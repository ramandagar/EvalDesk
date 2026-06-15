// ============================================================================
// EvalDesk TypeScript SDK — a thin, typed client over the /api/v1 surface.
// Async-aware: runs.create() returns at 202 and run.wait() polls until terminal.
// A DeepEval-parity gate (assertRunPasses) lets CI fail a build on regressions.
// fetchImpl is injectable so it runs in Node, the browser, or a contract test.
// ============================================================================

export interface EvalDeskOptions {
  baseUrl: string;
  /** Session token (sent as the evaldesk_session cookie) — or a future API key. */
  token: string;
  org: string;
  fetchImpl?: typeof fetch;
  /** Poll interval + timeout for run.wait (ms). */
  pollMs?: number;
  timeoutMs?: number;
}

export interface Run {
  id: string;
  projectId: string;
  status: "queued" | "running" | "completed" | "failed" | "signed";
  totalCases: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  unratedCount: number;
  passRate: number | null;
}

export class EvalDeskError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EvalDeskError";
  }
}

const TERMINAL = new Set(["completed", "failed", "signed"]);

export class EvalDesk {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly opts: EvalDeskOptions) {
    this.base = opts.baseUrl.replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.pollMs = opts.pollMs ?? 2500;
    this.timeoutMs = opts.timeoutMs ?? 300_000;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/api/v1${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-org-id": this.opts.org,
        cookie: `evaldesk_session=${this.opts.token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new EvalDeskError(res.status, json.error ?? `HTTP ${res.status}`);
    return json as T;
  }

  me() {
    return this.req<{ user: { id: string; email: string }; orgs: Array<{ id: string; role: string }> }>("GET", "/me");
  }

  projects = {
    list: () => this.req<{ projects: unknown[] }>("GET", "/projects").then((r) => r.projects),
    create: (input: { name: string; agentEndpoint?: string; agentApiKey?: string }) =>
      this.req<{ project: { id: string } }>("POST", "/projects", input).then((r) => r.project),
  };

  testCases = {
    create: (input: { projectId: string; title: string; input: string; expectedOutput?: string }) =>
      this.req<{ testCase: { id: string } }>("POST", "/test-cases", input).then((r) => r.testCase),
  };

  imports = {
    create: (projectId: string, data: string) =>
      this.req<{ result: { format: string; imported: number } }>("POST", "/imports", { projectId, data }).then((r) => r.result),
  };

  webhooks = {
    create: (input: { url: string; events: string[] }) =>
      this.req<{ webhook: { id: string; secret: string } }>("POST", "/webhooks", input).then((r) => r.webhook),
  };

  runs = {
    create: async (projectId: string, name?: string): Promise<RunHandle> => {
      const { run } = await this.req<{ run: Run }>("POST", "/runs", { projectId, name });
      return new RunHandle(this, run);
    },
    get: (id: string) => this.req<{ run: Run }>("GET", `/runs/${id}`).then((r) => r.run),
    certificate: (id: string) =>
      this.req<{ certificate: unknown }>("GET", `/runs/${id}/certificate`).then((r) => r.certificate),
  };

  /** Poll a run until terminal, or throw on timeout. */
  async waitForRun(id: string, opts?: { timeoutMs?: number; pollMs?: number; clock?: () => number; sleep?: (ms: number) => Promise<void> }): Promise<Run> {
    const timeoutMs = opts?.timeoutMs ?? this.timeoutMs;
    const pollMs = opts?.pollMs ?? this.pollMs;
    const clock = opts?.clock ?? Date.now;
    const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const start = clock();
    for (;;) {
      const run = await this.runs.get(id);
      if (TERMINAL.has(run.status)) return run;
      if (clock() - start > timeoutMs) throw new EvalDeskError(408, `run ${id} did not finish within ${timeoutMs}ms`);
      await sleep(pollMs);
    }
  }
}

export class RunHandle {
  constructor(
    private readonly client: EvalDesk,
    public run: Run,
  ) {}
  get id() {
    return this.run.id;
  }
  get status() {
    return this.run.status;
  }
  async wait(opts?: Parameters<EvalDesk["waitForRun"]>[1]): Promise<Run> {
    this.run = await this.client.waitForRun(this.run.id, opts);
    return this.run;
  }
}

export interface AssertOptions {
  minPassRate?: number; // 0..1
  maxFailures?: number;
}

/** DeepEval-style gate: throws (failing pytest/CI) when the run misses the bar. */
export function assertRunPasses(run: Run, opts: AssertOptions = {}): void {
  const decided = run.passCount + run.failCount + run.partialCount;
  const passRate = decided > 0 ? run.passCount / decided : 0;
  if (opts.minPassRate !== undefined && passRate < opts.minPassRate) {
    throw new EvalDeskError(
      422,
      `pass rate ${(passRate * 100).toFixed(1)}% is below the required ${(opts.minPassRate * 100).toFixed(1)}%`,
    );
  }
  if (opts.maxFailures !== undefined && run.failCount > opts.maxFailures) {
    throw new EvalDeskError(422, `${run.failCount} failures exceeds the allowed ${opts.maxFailures}`);
  }
}
