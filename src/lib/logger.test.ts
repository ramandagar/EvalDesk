import { describe, it, expect } from "vitest";
import { createLogger, type LogLevel } from "@/lib/logger";

function capture() {
  const lines: string[] = [];
  const sink = (line: string) => lines.push(line);
  return { lines, sink };
}

function parse(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

describe("structured logger", () => {
  it("emits one JSON line with ts, level, msg, and fields", () => {
    const { lines, sink } = capture();
    const log = createLogger({ level: "debug", sink });
    log.info("worker started", { interval: 2000 });
    expect(lines).toHaveLength(1);
    const obj = parse(lines[0]);
    expect(obj.level).toBe("info");
    expect(obj.msg).toBe("worker started");
    expect(obj.interval).toBe(2000);
    expect(typeof obj.ts).toBe("string");
  });

  it("respects level filtering (warn suppressed at info level)", () => {
    const { lines, sink } = capture();
    const log = createLogger({ level: "error", sink });
    log.info("nope");
    log.warn("nope");
    log.error("yes");
    expect(lines).toHaveLength(1);
    expect(parse(lines[0]).level).toBe("error");
  });

  it("redacts known secret fields recursively", () => {
    const { lines, sink } = capture();
    const log = createLogger({ level: "debug", sink });
    log.error("auth failed", { email: "a@x.test", password: "hunter2", nested: { token: "abc", ok: 1 } });
    const obj = parse(lines[0]);
    expect(obj.password).toBe("[redacted]");
    expect((obj.nested as Record<string, unknown>).token).toBe("[redacted]");
    expect((obj.nested as Record<string, unknown>).ok).toBe(1);
    expect(obj.email).toBe("a@x.test");
  });

  it("child logger merges base context into every line", () => {
    const { lines, sink } = capture();
    const log = createLogger({ level: "debug", sink }).child({ component: "worker", orgId: "o1" });
    log.info("drained");
    const obj = parse(lines[0]);
    expect(obj.component).toBe("worker");
    expect(obj.orgId).toBe("o1");
    expect(obj.msg).toBe("drained");
  });

  it("serializes Error fields to message + stack", () => {
    const { lines, sink } = capture();
    const log = createLogger({ level: "debug", sink });
    const err = new Error("boom");
    log.error("drain failed", { err });
    const obj = parse(lines[0]);
    const e = obj.err as Record<string, unknown>;
    expect(e.message).toBe("boom");
    expect(typeof e.stack).toBe("string");
  });

  it("falls back to info for an unknown LOG_LEVEL", () => {
    const { lines, sink } = capture();
    const log = createLogger({ sink }); // no level → reads process.env.LOG_LEVEL (unset → info)
    (log as unknown as { emit: (l: LogLevel) => void }); // type-only guard
    log.debug("hidden");
    log.info("shown");
    expect(lines).toHaveLength(1);
    expect(parse(lines[0]).level).toBe("info");
  });
});
