// ============================================================================
// Open-core boundary guard. The MIT core (src/**) must NEVER hard-depend on a
// commercial pack: compliance suites (@evaldesk/suite-*) are loaded at RUNTIME
// as data conforming to the manifest schema, never imported as code. This guard
// fails CI on any such import, so the open-source build always compiles + runs
// a full eval with the commercial registry disabled.
//
//   node scripts/check-open-core.mjs       # exits 1 on any violation
//   import { scanContent, scanSrc }         # used by the test
// ============================================================================

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const RULES = [
  {
    id: "no-commercial-suite-import",
    re: /(?:from\s+|require\(\s*|import\(\s*)["']@evaldesk\/suite-[^"']+["']/,
    msg: "imports a commercial @evaldesk/suite-* pack — load it at runtime via the manifest schema instead",
  },
  {
    id: "no-commercial-namespace-import",
    re: /(?:from\s+|require\(\s*|import\(\s*)["']@evaldesk\/(?:enterprise|cloud)[^"']*["']/,
    msg: "imports a commercial @evaldesk namespace into the MIT core",
  },
];

export function scanContent(name, content) {
  const violations = [];
  content.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) violations.push({ file: name, line: i + 1, rule: rule.id, msg: rule.msg });
    }
  });
  return violations;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "__tests__") continue; // tests plant violations on purpose
      out.push(...walk(p));
    } else if ((p.endsWith(".ts") || p.endsWith(".tsx")) && !p.endsWith(".test.ts") && !p.endsWith(".test.tsx")) {
      out.push(p);
    }
  }
  return out;
}

export function scanSrc() {
  const violations = [];
  for (const file of walk(SRC)) {
    violations.push(...scanContent(relative(ROOT, file), readFileSync(file, "utf8")));
  }
  return violations;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const violations = scanSrc();
  if (violations.length) {
    console.error("Open-core boundary FAILED:");
    for (const v of violations) console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.msg}`);
    process.exit(1);
  }
  console.log("✓ open-core boundary clean");
}
