/**
 * Golden set management — mark/unmark test cases as golden reference cases,
 * export to JSON, and validate consistency of golden cases.
 */

import { db } from "@/db";
import { testCases } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface GoldenSetExport {
  exportedAt: string;
  version: string;
  totalCases: number;
  cases: GoldenSetCase[];
}

export interface GoldenSetCase {
  id: string;
  title: string;
  input: string;
  expectedOutput: string | null;
  category: string | null;
  tags: string | null;
  difficulty: string | null;
  source: string | null;
}

export interface GoldenSetValidation {
  valid: boolean;
  totalGolden: number;
  issues: GoldenSetIssue[];
  summary: string;
}

export interface GoldenSetIssue {
  testCaseId: string;
  title: string;
  issue: string;
  severity: "error" | "warning";
}

/**
 * Mark test cases as part of the golden set.
 */
export async function markAsGolden(caseIds: string[]): Promise<number> {
  if (!caseIds.length) return 0;

  const results = await db
    .update(testCases)
    .set({ goldenSet: true, updatedAt: new Date() })
    .where(inArray(testCases.id, caseIds))
    .returning({ id: testCases.id });

  return results.length;
}

/**
 * Remove test cases from the golden set.
 */
export async function unmarkAsGolden(caseIds: string[]): Promise<number> {
  if (!caseIds.length) return 0;

  const results = await db
    .update(testCases)
    .set({ goldenSet: false, updatedAt: new Date() })
    .where(inArray(testCases.id, caseIds))
    .returning({ id: testCases.id });

  return results.length;
}

/**
 * Get all golden set cases for a project.
 */
export async function getGoldenCases(projectId: string) {
  return db
    .select()
    .from(testCases)
    .where(and(eq(testCases.projectId, projectId), eq(testCases.goldenSet, true)));
}

/**
 * Export golden set cases as a JSON-serializable object for download.
 */
export async function exportGoldenSet(projectId: string): Promise<GoldenSetExport> {
  const cases = await getGoldenCases(projectId);

  const exported: GoldenSetCase[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    input: c.input,
    expectedOutput: c.expectedOutput,
    category: c.category,
    tags: c.tags,
    difficulty: c.difficulty,
    source: c.source,
  }));

  return {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    totalCases: exported.length,
    cases: exported,
  };
}

/**
 * Validate golden set cases for consistency.
 * Checks:
 *  - All golden cases must have an expectedOutput
 *  - All golden cases should have a non-empty title
 *  - Warn if golden cases lack category or difficulty
 *  - Warn if duplicate inputs exist within golden set
 */
export async function validateGoldenSet(projectId: string): Promise<GoldenSetValidation> {
  const cases = await getGoldenCases(projectId);
  const issues: GoldenSetIssue[] = [];

  const seenInputs = new Map<string, string>();

  for (const tc of cases) {
    // Error: missing expectedOutput
    if (!tc.expectedOutput || tc.expectedOutput.trim().length === 0) {
      issues.push({
        testCaseId: tc.id,
        title: tc.title,
        issue: "Missing expected output — golden cases must define what a correct response looks like.",
        severity: "error",
      });
    }

    // Error: empty title
    if (!tc.title || tc.title.trim().length === 0) {
      issues.push({
        testCaseId: tc.id,
        title: "(untitled)",
        issue: "Empty title — golden cases should have descriptive titles.",
        severity: "error",
      });
    }

    // Warning: no category
    if (!tc.category) {
      issues.push({
        testCaseId: tc.id,
        title: tc.title,
        issue: "No category assigned — consider categorizing for better organization.",
        severity: "warning",
      });
    }

    // Warning: no difficulty
    if (!tc.difficulty) {
      issues.push({
        testCaseId: tc.id,
        title: tc.title,
        issue: "No difficulty level — golden cases should specify difficulty for balanced coverage.",
        severity: "warning",
      });
    }

    // Warning: duplicate input
    const inputKey = tc.input.trim().toLowerCase();
    if (seenInputs.has(inputKey)) {
      issues.push({
        testCaseId: tc.id,
        title: tc.title,
        issue: `Duplicate input found (same as case "${seenInputs.get(inputKey)}") — golden set should have unique inputs.`,
        severity: "warning",
      });
    } else {
      seenInputs.set(inputKey, tc.title);
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const valid = errorCount === 0;
  const summary = valid
    ? `Golden set is valid (${cases.length} cases, ${issues.length} warnings).`
    : `Golden set has ${errorCount} error(s) and ${issues.length - errorCount} warning(s) across ${cases.length} cases.`;

  return { valid, totalGolden: cases.length, issues, summary };
}
