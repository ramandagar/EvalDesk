// ============================================================================
// Compliance suite engine — PURE. The MIT core knows only the suite MANIFEST
// SCHEMA and how to run/score a suite; the actual content packs (HIPAA / RBI /
// EU-AI-Act) are COMMERCIAL npm packages (@evaldesk/suite-*) that ship a
// manifest matching this schema. A suite maps regulatory controls → the test
// categories that exercise them + a per-control pass gate + whether expert
// sign-off is required. A suite-scoped run yields a control-coverage matrix
// that flows into the signed certificate.
// ============================================================================

import { z } from "zod";

export const suiteControlSchema = z.object({
  id: z.string().min(1), // e.g. "164.312(a)(1)"
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1), // test-case category that exercises this control
  minPassRate: z.number().min(0).max(1).optional(), // gate (default 1.0 = all must pass)
  requireSignoff: z.boolean().optional(),
});

export const suiteManifestSchema = z.object({
  id: z.string().min(1), // e.g. "hipaa"
  name: z.string().min(1),
  version: z.string().min(1),
  regulation: z.string().min(1), // e.g. "HIPAA Security Rule"
  controls: z.array(suiteControlSchema).min(1),
});

export type SuiteControl = z.infer<typeof suiteControlSchema>;
export type SuiteManifest = z.infer<typeof suiteManifestSchema>;

export class SuiteError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "SuiteError";
  }
}

/** Parse + validate an untrusted manifest (e.g. loaded from a commercial pack). */
export function parseSuiteManifest(raw: unknown): SuiteManifest {
  const result = suiteManifestSchema.safeParse(raw);
  if (!result.success) throw new SuiteError(`Invalid suite manifest: ${result.error.issues[0]?.message ?? "unknown"}`);
  // control ids must be unique
  const ids = new Set<string>();
  for (const c of result.data.controls) {
    if (ids.has(c.id)) throw new SuiteError(`Duplicate control id: ${c.id}`);
    ids.add(c.id);
  }
  return result.data;
}

// --- Control coverage --------------------------------------------------------

/** One adjudicated result, reduced to what coverage needs. */
export interface CoverageItem {
  category: string | null;
  finalLabel: string; // "pass" | "partial" | "fail" (from the rubric)
}

export interface ControlCoverage {
  id: string;
  title: string;
  covered: boolean; // any test case exercised this control?
  total: number; // cases mapped to this control
  passed: number;
  passRate: number; // passed/total (0 when total=0)
  gate: number; // the required pass rate
  status: "pass" | "fail" | "uncovered";
}

export interface CoverageReport {
  suiteId: string;
  version: string;
  controls: ControlCoverage[];
  controlsCovered: number;
  controlsTotal: number;
  controlsPassed: number;
  /** All controls covered AND passing — the suite-level verdict. */
  compliant: boolean;
}

export function computeCoverage(manifest: SuiteManifest, items: CoverageItem[], passLabel = "pass"): CoverageReport {
  const byCategory = new Map<string, CoverageItem[]>();
  for (const it of items) {
    if (it.category == null) continue;
    (byCategory.get(it.category) ?? byCategory.set(it.category, []).get(it.category)!).push(it);
  }

  const controls: ControlCoverage[] = manifest.controls.map((c) => {
    const mapped = byCategory.get(c.category) ?? [];
    const total = mapped.length;
    const passed = mapped.filter((m) => m.finalLabel === passLabel).length;
    const passRate = total > 0 ? passed / total : 0;
    const gate = c.minPassRate ?? 1;
    const covered = total > 0;
    const status: ControlCoverage["status"] = !covered ? "uncovered" : passRate >= gate ? "pass" : "fail";
    return { id: c.id, title: c.title, covered, total, passed, passRate, gate, status };
  });

  const controlsCovered = controls.filter((c) => c.covered).length;
  const controlsPassed = controls.filter((c) => c.status === "pass").length;
  return {
    suiteId: manifest.id,
    version: manifest.version,
    controls,
    controlsCovered,
    controlsTotal: controls.length,
    controlsPassed,
    compliant: controls.every((c) => c.status === "pass"),
  };
}
