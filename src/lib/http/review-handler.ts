import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

function org(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

function isBlind(req: Request): boolean {
  return new URL(req.url).searchParams.get("blind") === "true";
}

const verdictSchema = z.object({
  label: z.string().min(1).max(64),
  attemptId: z.string().min(1).max(128),
  rationale: z.string().max(10_000).optional(),
  scoreNum: z.number().min(0).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const signoffSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(10_000).optional(),
});

/** GET /runs/:id/queue — results still needing a human verdict (blind-aware, paginated). */
export async function handleReviewQueue(req: Request, c: Container, runId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const url = new URL(req.url);
    const limit = url.searchParams.has("limit") ? Math.min(Number(url.searchParams.get("limit")), 100) : 20;
    const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : 0;
    const result = await c.review.queue(getSessionToken(req), o.orgId, runId, { blind: isBlind(req), limit, offset });
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /results/:id — a single review item (blind-aware). */
export async function handleGetReviewItem(req: Request, c: Container, resultId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const item = await c.review.getItem(getSessionToken(req), o.orgId, resultId, { blind: isBlind(req) });
    return json({ item });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /results/:id/verdicts — submit (or correct) a human verdict. */
export async function handleSubmitVerdict(req: Request, c: Container, resultId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = verdictSchema.parse(await req.json());
    const result = await c.review.submitVerdict(getSessionToken(req), o.orgId, resultId, body);
    return json({ result }, result.inserted ? 201 : 200);
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /runs/:id/signoff — approve or reject a run for sign-off. */
export async function handleSubmitSignoff(req: Request, c: Container, runId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const body = signoffSchema.parse(await req.json());
    const result = await c.review.submitSignoff(getSessionToken(req), o.orgId, runId, body);
    return json({ result });
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /runs/:id/report?format=html|csv|json — downloadable, self-verifiable report. */
export async function handleExportReport(req: Request, c: Container, runId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const token = getSessionToken(req);
    const format = new URL(req.url).searchParams.get("format") ?? "html";

    const report = await c.review.runReport(token, o.orgId, runId);
    const project = await c.projects.get(token, o.orgId, report.run.projectId).catch(() => null);
    const cert = await c.review.getCertificate(token, o.orgId, runId).catch(() => null);
    const calib = await c.review.getCalibration(token, o.orgId, report.run.projectId).catch(() => null);

    const rows = report.results.map((r) => ({
      title: r.title,
      input: r.input,
      agentResponse: r.agentResponse,
      aiLabel: r.aiScores[0]?.label ?? null,
      humanLabel: r.humanRatings[0]?.label ?? null,
      finalLabel: r.finalLabel,
    }));

    if (format === "json") {
      return json({ run: report.run, project: project?.name ?? null, agreement: calib?.agreement ?? null, certificate: cert, results: rows });
    }

    const { renderHtmlReport, renderCsv } = await import("@/lib/report/html-report");
    if (format === "csv") {
      return new Response(renderCsv(rows), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="evaldesk-run-${runId}.csv"` },
      });
    }

    const m = calib?.agreement as { kappa?: number | null; kappaMethod?: string | null; nItems?: number | null; aiHumanAgreementPct?: number | null } | null;
    const html = renderHtmlReport({
      run: { ...report.run, projectName: project?.name ?? "Project" },
      rows,
      agreement: m ? { kappa: m.kappa ?? null, kappaMethod: m.kappaMethod ?? null, nItems: m.nItems ?? null, agreementPct: m.aiHumanAgreementPct ?? null } : null,
      certificate: cert,
      generatedAt: Date.now(),
    });
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `inline; filename="evaldesk-run-${runId}.html"` },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /compare?a=runId&b=runId — case-by-case verdict diff of two runs. */
export async function handleCompare(req: Request, c: Container): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const url = new URL(req.url);
    const a = url.searchParams.get("a");
    const b = url.searchParams.get("b");
    if (!a || !b) return json({ error: "a and b run ids required" }, 400);
    const result = await c.review.compareRuns(getSessionToken(req), o.orgId, a, b);
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /runs/:id/coverage?suite=hipaa — control-coverage matrix against a compliance suite. */
export async function handleRunCoverage(req: Request, c: Container, runId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const suiteId = new URL(req.url).searchParams.get("suite");
    if (!suiteId) return json({ error: "?suite= is required (e.g. hipaa)" }, 400);
    const result = await c.review.runCoverage(getSessionToken(req), o.orgId, runId, suiteId);
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /runs/:id/results — full per-result report (agent answer + scores + verdicts). */
export async function handleRunReport(req: Request, c: Container, runId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const report = await c.review.runReport(getSessionToken(req), o.orgId, runId);
    return json(report);
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /projects/:id/calibration — the project's AI-vs-human calibration + agreement. */
export async function handleGetCalibration(req: Request, c: Container, projectId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const data = await c.review.getCalibration(getSessionToken(req), o.orgId, projectId);
    return json(data);
  } catch (e) {
    return errorResponse(e);
  }
}

/** GET /runs/:id/certificate — the signed, offline-verifiable certificate bundle. */
export async function handleGetCertificate(req: Request, c: Container, runId: string): Promise<Response> {
  try {
    const o = org(req);
    if (o instanceof Response) return o;
    const cert = await c.review.getCertificate(getSessionToken(req), o.orgId, runId);
    if (!cert) return json({ error: "No certificate for this run" }, 404);
    return json({ certificate: cert });
  } catch (e) {
    return errorResponse(e);
  }
}
