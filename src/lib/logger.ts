// ============================================================================
// Structured logger — one JSON object per line (ts, level, msg, ...fields).
// Dependency-free, redacts known secret fields, level-controlled by LOG_LEVEL.
// Replaces ad-hoc console.* across the worker + request error path so logs are
// machine-parseable in production. A `child(fields)` helper attaches request /
// worker context. The default `logger` singleton writes to stdout (info/debug)
// and stderr (warn/error); tests inject a capturing sink.
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Keys whose values must never appear in logs. Matched case-insensitively.
const SECRET_KEY = /^(password|token|secret|apikey|api_key|keyhash|key_hash|ciphertext|authorization|cookie|privatekey|private_key|signingkey)$/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { message: value.message, name: value.name, stack: value.stack };
  const out: LogFields = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Returns a logger that always merges `fields` into every emitted line. */
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  /** Override the output sink (default: stdout for info/debug, stderr for warn/error). */
  sink?: (line: string, level: LogLevel) => void;
  base?: LogFields;
}

function resolveLevel(env?: string): LogLevel {
  const l = (env ?? "info").toLowerCase();
  return l in LEVELS ? (l as LogLevel) : "info";
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const level = opts.level ?? resolveLevel(process.env.LOG_LEVEL);
  const threshold = LEVELS[level];
  const base = opts.base ?? {};
  const sink =
    opts.sink ??
    ((line: string, lvl: LogLevel) => {
      const stream = lvl === "warn" || lvl === "error" ? process.stderr : process.stdout;
      stream.write(line + "\n");
    });

  function emit(lvl: LogLevel, msg: string, fields?: LogFields) {
    if (LEVELS[lvl] < threshold) return;
    const ctx = redact({ ...base, ...(fields ?? {}) }) as LogFields;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...ctx,
    });
    sink(line, lvl);
  }

  const root: Logger = {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (fields) => createLogger({ level, sink, base: { ...base, ...fields } }),
  };
  return root;
}

/** Default process-wide logger. */
export const logger = createLogger();
