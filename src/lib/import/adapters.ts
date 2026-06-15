// ============================================================================
// Evals import adapters — PURE parsers, zero IO. Each adapter has detect(raw)
// (conservative — only claims a format it is confident about) and parse(raw) →
// normalized test cases. Unrecognized / mis-shaped input raises an explicit
// error with context rather than silently mis-mapping (esp. OpenAI-Evals).
// The import service does auth/size/persistence; this module only normalizes.
// ============================================================================

export interface NormalizedTestCase {
  title: string;
  input: string;
  expectedOutput: string | null;
  category: string | null;
}

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly line?: number,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export interface ImportAdapter {
  id: string;
  detect(raw: string): boolean;
  parse(raw: string): NormalizedTestCase[];
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
}

/** Parse newline-delimited JSON into objects, tracking line numbers for errors. */
function parseJsonl(raw: string): Array<{ obj: Record<string, unknown>; line: number }> {
  const out: Array<{ obj: Record<string, unknown>; line: number }> = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      throw new ImportError(`Line ${i + 1} is not valid JSON`, "invalid_jsonl", i + 1);
    }
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new ImportError(`Line ${i + 1} is not a JSON object`, "invalid_jsonl", i + 1);
    }
    out.push({ obj: obj as Record<string, unknown>, line: i + 1 });
  }
  return out;
}

// --- DeepEval ----------------------------------------------------------------
// DeepEval datasets are JSON: { goldens|test_cases: [{ input, expected_output|
// actual_output, context?, ... }] } or a bare array of such objects.
const deepeval: ImportAdapter = {
  id: "deepeval",
  detect(raw) {
    try {
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : j?.goldens ?? j?.test_cases;
      return Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "object" && "input" in arr[0];
    } catch {
      return false;
    }
  },
  parse(raw) {
    const j = JSON.parse(raw);
    const arr: unknown[] = Array.isArray(j) ? j : (j?.goldens ?? j?.test_cases ?? []);
    if (!Array.isArray(arr) || arr.length === 0) throw new ImportError("No goldens/test_cases found", "empty");
    return arr.map((item, i) => {
      const o = item as Record<string, unknown>;
      if (!("input" in o)) throw new ImportError(`Item ${i} has no "input"`, "missing_input");
      return {
        title: asString(o.name ?? `Case ${i + 1}`).slice(0, 200),
        input: asString(o.input),
        expectedOutput: o.expected_output != null ? asString(o.expected_output) : null,
        category: o.category != null ? asString(o.category) : null,
      };
    });
  },
};

// --- Langfuse ----------------------------------------------------------------
// Langfuse dataset items: { items: [{ input, expected_output|expectedOutput,
// metadata? }] } or a bare array of items with input + expected_output.
const langfuse: ImportAdapter = {
  id: "langfuse",
  detect(raw) {
    try {
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : j?.items;
      if (!Array.isArray(arr) || arr.length === 0) return false;
      const first = arr[0] as Record<string, unknown>;
      return typeof first === "object" && "input" in first && ("expected_output" in first || "expectedOutput" in first);
    } catch {
      return false;
    }
  },
  parse(raw) {
    const j = JSON.parse(raw);
    const arr: unknown[] = Array.isArray(j) ? j : (j?.items ?? []);
    if (!Array.isArray(arr) || arr.length === 0) throw new ImportError("No items found", "empty");
    return arr.map((item, i) => {
      const o = item as Record<string, unknown>;
      const expected = o.expected_output ?? o.expectedOutput;
      return {
        title: asString(o.id ?? o.name ?? `Item ${i + 1}`).slice(0, 200),
        input: asString(o.input),
        expectedOutput: expected != null ? asString(expected) : null,
        category: (o.metadata as Record<string, unknown> | undefined)?.category != null ? asString((o.metadata as Record<string, unknown>).category) : null,
      };
    });
  },
};

// --- OpenAI Evals ------------------------------------------------------------
// JSONL samples: { input: [{role,content}...], ideal: string|string[] }.
// detect() is CONSERVATIVE — it requires the chat-format input array, and
// parse() raises unsupported_sample_shape (with a line number) rather than
// guessing on an unexpected shape.
const openaiEvals: ImportAdapter = {
  id: "openai_evals",
  detect(raw) {
    const firstLine = raw.split("\n").map((l) => l.trim()).find(Boolean);
    if (!firstLine) return false;
    try {
      const o = JSON.parse(firstLine) as Record<string, unknown>;
      return Array.isArray(o.input) && (typeof o.input[0] === "object") && "ideal" in o;
    } catch {
      return false;
    }
  },
  parse(raw) {
    const rows = parseJsonl(raw);
    if (rows.length === 0) throw new ImportError("No samples found", "empty");
    return rows.map(({ obj, line }, i) => {
      if (!Array.isArray(obj.input)) {
        throw new ImportError(`Line ${line}: expected a chat "input" array`, "unsupported_sample_shape", line);
      }
      const messages = obj.input as Array<Record<string, unknown>>;
      const text = messages
        .map((m) => `${asString(m.role)}: ${asString(m.content)}`)
        .join("\n");
      const ideal = obj.ideal;
      const expected = Array.isArray(ideal) ? ideal.map(asString).join(" | ") : ideal != null ? asString(ideal) : null;
      return { title: `Sample ${i + 1}`, input: text, expectedOutput: expected, category: null };
    });
  },
};

export const ADAPTERS: ImportAdapter[] = [openaiEvals, deepeval, langfuse];

export interface DetectResult {
  adapter: ImportAdapter;
  cases: NormalizedTestCase[];
}

/** Detect the format and parse. Throws ImportError if nothing matches. */
export function detectAndParse(raw: string): DetectResult {
  for (const adapter of ADAPTERS) {
    if (adapter.detect(raw)) return { adapter, cases: adapter.parse(raw) };
  }
  throw new ImportError("Could not detect a supported eval format (deepeval, langfuse, openai_evals)", "unknown_format");
}
