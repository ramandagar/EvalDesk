import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

/** GET /analytics — org-wide eval metrics computed in app code from run rows
 *  (no DB date functions, so it's identical on SQLite + Postgres). */
export async function handleAnalytics(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const token = getSessionToken(req);
    const [runs, projects] = await Promise.all([c.runs.listForOrg(token, o.orgId), c.projects.list(token, o.orgId)]);
    const projectName = new Map(projects.map((p) => [p.id, p.name]));

    const totalRuns = runs.length;
    const totalCases = runs.reduce((n, r) => n + r.totalCases, 0);
    const pass = runs.reduce((n, r) => n + r.passCount, 0);
    const fail = runs.reduce((n, r) => n + r.failCount, 0);
    const partial = runs.reduce((n, r) => n + r.partialCount, 0);
    const needsReview = runs.reduce((n, r) => n + r.unratedCount, 0);
    const decided = pass + fail + partial;

    // pass-rate trend (oldest → newest), only finished runs with a rate
    const trend = [...runs]
      .filter((r) => r.passRate != null)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({ runId: r.id, project: projectName.get(r.projectId) ?? "", passRate: r.passRate, at: r.createdAt }));

    // per-project rollup
    const byProject = new Map<string, { project: string; runs: number; pass: number; decided: number }>();
    for (const r of runs) {
      const key = r.projectId;
      const e = byProject.get(key) ?? { project: projectName.get(key) ?? "", runs: 0, pass: 0, decided: 0 };
      e.runs += 1;
      e.pass += r.passCount;
      e.decided += r.passCount + r.failCount + r.partialCount;
      byProject.set(key, e);
    }
    const perProject = [...byProject.values()].map((e) => ({ ...e, passRate: e.decided > 0 ? Math.round((e.pass / e.decided) * 100) : null }));

    return json({
      totals: { runs: totalRuns, cases: totalCases, pass, fail, partial, needsReview, passRate: decided > 0 ? Math.round((pass / decided) * 100) : null },
      labelDistribution: { pass, fail, partial },
      trend,
      perProject,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
