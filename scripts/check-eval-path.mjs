// ============================================================================
// Eval-path guard. The eval path (src/lib/ai/**, excluding providers/) must not
// call fetch() directly, read an LLM key from env, or import the @/db singleton.
// Those concerns are injected (Provider, Store). This guard fails CI on any
// violation so the testability invariant can never silently regress.
//
//   node scripts/check-eval-path.mjs        # exits 1 on any violation
//   import { scanEvalPath, scanContent }     # used by eval-path-guard.test.ts
// ============================================================================

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVAL_PATH_DIR = join(ROOT, "src", "lib", "ai");
// The one sanctioned place allowed to touch the network.
const ALLOWED_FETCH_DIR = join(EVAL_PATH_DIR, "providers");

const RULES = [
  { id: "no-raw-fetch", re: /\bfetch\s*\(/, msg: "raw fetch() — call an injected Provider instead" },
  {
    id: "no-llm-env",
    re: /process\.env\.[A-Z0-9_]*(?:API_KEY|OPENAI|ANTHROPIC)[A-Z0-9_]*/,
    msg: "reads an LLM key from env — inject the Provider at the composition root",
  },
  {
    id: "no-db-singleton",
    re: /from\s+["']@\/db["']/,
    msg: "imports the @/db singleton — inject a Store port instead",
  },
];

/** Scan a single file's content; returns an array of violations. */
export function scanContent(name, content) {
  const violations = [];
  content.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return; // skip comments
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        violations.push({ file: name, line: i + 1, rule: rule.id, msg: rule.msg });
      }
    }
  });
  return violations;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (p === ALLOWED_FETCH_DIR) continue;
      out.push(...walk(p));
    } else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

/** Scan every eval-path file; returns all violations. */
export function scanEvalPath() {
  const violations = [];
  for (const file of walk(EVAL_PATH_DIR)) {
    violations.push(...scanContent(relative(ROOT, file), readFileSync(file, "utf8")));
  }
  return violations;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const violations = scanEvalPath();
  if (violations.length) {
    console.error("Eval-path guard FAILED:");
    for (const v of violations) console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.msg}`);
    process.exit(1);
  }
  console.log("✓ eval-path clean");
}
