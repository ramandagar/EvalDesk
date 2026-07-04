// ============================================================================
// Demo handler — public, no auth. Fetches the demo org's latest signed run and
// returns a curated snapshot: run summary + 3 sample results + certificate.
// Designed for the /demo marketing page (no X-Org-Id, no session cookie).
// The data is seeded by `npm run seed`.
// ============================================================================

import { getRuntime } from "@/db/runtime";
import { organizationsRepo } from "@/db/repos/organizations";
import { projectsRepo } from "@/db/repos/projects";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { testCasesRepo } from "@/db/repos/test-cases";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { adjudicationsRepo } from "@/db/repos/adjudications";
import { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import { computeCoverage } from "@/lib/suites/manifest";
import { listSuitePacks } from "@/lib/suites/packs";
import type { Container } from "./container";
import { json } from "./responses";

const DEMO_SLUG = "demo";

export async function handleDemo(_c: Container): Promise<Response> {
  try {
    const { db, schema } = getRuntime();
    const orgs = organizationsRepo(db, schema);
    const projects = projectsRepo(db, schema);
    const runs = runsRepo(db, schema);
    const runResults = runResultsRepo(db, schema);
    const testCases = testCasesRepo(db, schema);
    const aiScores = aiScoresRepo(db, schema);
    const adjudications = adjudicationsRepo(db, schema);
    const certs = evalCertificatesRepo(db, schema);

    // 1. Find demo org
    const demoOrg = await orgs.getBySlug(DEMO_SLUG);
    if (!demoOrg) {
      return json({ error: "Demo not seeded. Run: npm run seed" }, 404);
    }

    // 2. Find latest completed / signed run across demo org's projects
    const allRuns = await runs.listForOrg(demoOrg.id, 50);
    const completedRun = allRuns
      .filter((r) => r.status === "signed" || r.status === "completed")
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];

    if (!completedRun) {
      return json({ error: "Demo not seeded. Run: npm run seed" }, 404);
    }

    // 3. Results — take 3 samples for the preview
    const results = await runResults.listForRun(demoOrg.id, completedRun.id);
    const resultIds = results.map((r) => r.id);
    const aiScoreRows = await aiScores.listForResults(demoOrg.id, resultIds);
    const adjRows = await adjudications.listForResults(demoOrg.id, resultIds);
    const adjByResult = new Map(adjRows.map((a) => [a.runResultId, a.finalLabel]));
    const aiByResult = new Map<string, (typeof aiScoreRows)[0]>();
    for (const s of aiScoreRows) {
      if (!aiByResult.has(s.runResultId)) aiByResult.set(s.runResultId, s);
    }

    // Load test cases for all results
    const projectTcs = await testCases.listForProject(demoOrg.id, completedRun.projectId);
    const tcById = new Map(projectTcs.map((tc) => [tc.id, tc]));

    const sampleResults = results.slice(0, 3).map((r) => {
      const tc = tcById.get(r.testCaseId);
      const ai = aiByResult.get(r.id);
      return {
        resultId: r.id,
        title: tc?.title ?? "",
        input: tc?.input ?? "",
        expectedOutput: tc?.expectedOutput ?? null,
        category: tc?.category ?? null,
        agentResponse: r.agentResponse,
        aiLabel: ai?.label ?? null,
        aiConfidence: ai?.confidence ?? null,
        finalLabel: adjByResult.get(r.id) ?? null,
      };
    });

    // 4. Certificate
    const cert = await certs.getForRun(demoOrg.id, completedRun.id);

    // 5. HIPAA coverage (auto-detect; fall back gracefully)
    let coverage: ReturnType<typeof computeCoverage> | null = null;
    const packs = listSuitePacks();
    const hipaaPack = packs.find((p) => p.id === "hipaa");
    if (hipaaPack) {
      const coverageItems = results
        .map((r) => ({
          category: tcById.get(r.testCaseId)?.category ?? null,
          finalLabel: adjByResult.get(r.id) ?? "uncovered",
        }))
        .filter((it) => it.category != null) as Array<{ category: string; finalLabel: string }>;
      coverage = computeCoverage(hipaaPack, coverageItems);
    }

    // 6. Project name
    const project = await projects.getInOrg(demoOrg.id, completedRun.projectId);

    return json({
      run: {
        id: completedRun.id,
        projectName: project?.name ?? "MedTriage AI",
        status: completedRun.status,
        totalCases: completedRun.totalCases,
        passCount: completedRun.passCount,
        failCount: completedRun.failCount,
        partialCount: completedRun.partialCount,
        unratedCount: completedRun.unratedCount,
        passRate: completedRun.passRate,
        createdAt: completedRun.createdAt,
        completedAt: completedRun.completedAt,
      },
      results: sampleResults,
      certificate: cert
        ? {
            id: cert.id,
            contentHash: cert.contentHash,
            signature: cert.signature,
            algo: cert.algo,
            signedAt: cert.signedAt,
          }
        : null,
      coverage: coverage ?? null,
    });
  } catch (e) {
    console.error("[demo] error:", e);
    return json({ error: "Demo not seeded. Run: npm run seed" }, 404);
  }
}
