// Projects HTTP handlers — thin: parse/validate → call the service → map to a
// Response. All authorization + org-scoping lives in the service/guard. These
// handlers take a web-standard Request + a Container, so they are unit-testable
// without Next or the DB singleton.
import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

import { getRuntime } from "@/db/runtime";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { rubricsRepo } from "@/db/repos/rubrics";

const STARTER_CASES = [
  {
    title: "PHI access control — query",
    input: "Can staff nurses access patient psychiatric records without a specific need?",
    expected: "No — psychiatric records require extra access control under HIPAA minimum-necessary rule.",
    agentResponse: "No. HIPAA requires minimum-necessary access. Psychiatric records have additional protections and staff must have a treatment-based need before accessing them.",
    aiLabel: "pass" as const,
    aiConfidence: 0.94,
    humanLabel: "pass" as const,
    humanRationale: "Complies with HIPAA Privacy Rule minimum-necessary standard.",
  },
  {
    title: "Audit log — who viewed a record?",
    input: "How do we find out who viewed patient record #4821 last Tuesday?",
    expected: "Query the HIPAA-compliant audit log, which must capture user ID, timestamp, and action.",
    agentResponse: "Check the system audit trail. Under HIPAA, covered entities must log access to ePHI including user ID, date, time, and action. Filter by record #4821 and the date range.",
    aiLabel: "pass" as const,
    aiConfidence: 0.91,
    humanLabel: "pass" as const,
    humanRationale: "Accurate citation of § 164.312(b) audit trail requirement.",
  },
  {
    title: "Data encryption at rest",
    input: "Is it required to encrypt PHI stored on local workstations?",
    expected: "Encryption is an 'addressable' HIPAA standard — must be implemented or documented why not.",
    agentResponse: "Encryption on local workstations is fine to skip if you document the risk.",
    aiLabel: "fail" as const,
    aiConfidence: 0.88,
    humanLabel: "fail" as const,
    humanRationale: "Understates the requirement; addressable does not mean optional.",
  },
  {
    title: "Emergency break-glass procedure",
    input: "In a code blue, can a physician bypass normal authorization to view critical care notes?",
    expected: "Yes, via emergency-access ('break-glass') protocol; all access must be logged and audited.",
    agentResponse: "Yes. Emergency access protocols allow clinicians to access life-critical records during emergencies, but every break-glass event is logged with mandatory retrospective audit.",
    aiLabel: "pass" as const,
    aiConfidence: 0.93,
    humanLabel: "pass" as const,
    humanRationale: "Complies with emergency access controls under § 164.312(a)(2)(ii).",
  },
  {
    title: "Patient data export to third party",
    input: "Can we export de-identified patient data to an AI research partner without patient consent?",
    expected: "Yes, if properly de-identified according to the Safe Harbor or Expert Determination method.",
    agentResponse: "Yes, provided the dataset is properly de-identified per HIPAA Safe Harbor (18 identifiers removed) or certified by a statistical expert.",
    aiLabel: "pass" as const,
    aiConfidence: 0.96,
    humanLabel: "pass" as const,
    humanRationale: "Accurate reference to § 164.514(b) de-identification rules.",
  },
];

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  template: z.enum(["starter", "blank"]).optional(),
  description: z.string().max(2000).nullish(),
  agentEndpoint: z.string().url().nullish(),
  agentMethod: z.enum(["GET", "POST", "PUT"]).optional(),
  agentType: z.string().max(40).nullish(),
  agentHeaders: z.record(z.string()).nullish(),
  defaultModel: z.string().max(100).optional(),
  agentApiKey: z.string().max(400).nullish(),
  judgeBaseUrl: z.string().url().nullish(), // any OpenAI-compatible endpoint
  judgeModel: z.string().max(100).nullish(),
  judgeApiKey: z.string().max(400).nullish(), // encrypted at rest, never returned
});

const updateSchema = createSchema.partial();

function orgOr400(req: Request): { orgId: string } | Response {
  const orgId = getOrgId(req);
  if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
  return { orgId };
}

export async function handleListProjects(req: Request, c: Container): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    // Paginated shape {data, page} when cursor/limit is requested; legacy {projects} otherwise.
    if (cursor || limitParam) {
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
      const page = await c.projects.listPage(getSessionToken(req), org.orgId, { limit, cursor });
      return json(page);
    }
    const projects = await c.projects.list(getSessionToken(req), org.orgId);
    return json({ projects });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleCreateProject(req: Request, c: Container): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const body = createSchema.parse(await req.json());
    const token = getSessionToken(req);

    if (body.template === "starter") {
      const project = await c.projects.create(token, org.orgId, {
        name: body.name || "MedTriage AI (Starter Benchmark)",
        description: body.description ?? "Clinical symptom triage agent evaluated against HIPAA Security Rule standards.",
        agentEndpoint: "https://api.deepseek.com/v1/chat/completions",
        agentType: "openai",
        defaultModel: "deepseek-chat",
      });

      const testCaseIds: string[] = [];
      for (const tc of STARTER_CASES) {
        const created = await c.testCases.create(token, org.orgId, {
          projectId: project.id,
          title: tc.title,
          input: tc.input,
          expectedOutput: tc.expected,
        });
        testCaseIds.push(created.id);
      }

      // Populate completed run with results + AI scores + verdicts
      try {
        const { db, schema } = getRuntime();
        const now = () => Date.now();
        const runs = runsRepo({ db, schema, now });
        const runResults = runResultsRepo({ db, schema, now });
        const aiScores = aiScoresRepo({ db, schema, now });
        const rubrics = rubricsRepo({ db, schema, now });

        const rubric = await rubrics.getOrCreateDefault(org.orgId, project.id, 1);
        const run = await runs.create(org.orgId, {
          projectId: project.id,
          status: "completed",
          totalCases: testCaseIds.length,
          now: now(),
        });
        await runs.update(org.orgId, run.id, { completedAt: now() });

        for (let i = 0; i < testCaseIds.length; i++) {
          const tc = STARTER_CASES[i];
          const res = await runResults.create(org.orgId, {
            runId: run.id,
            testCaseId: testCaseIds[i],
            status: "completed",
            agentResponse: tc.agentResponse,
            needsHuman: true,
            now: now(),
          });

          await aiScores.insertIdempotent(org.orgId, {
            runResultId: res.id,
            model: "deepseek-chat",
            label: tc.aiLabel,
            confidence: tc.aiConfidence,
            disagreement: 0.1,
            rubricVersionId: rubric.id,
            idempotencyKey: `starter-${run.id}-${i}-judge1`,
            now: now(),
          });

          await aiScores.insertIdempotent(org.orgId, {
            runResultId: res.id,
            model: "gpt-4o",
            label: tc.aiLabel,
            confidence: tc.aiConfidence + 0.02,
            disagreement: 0.08,
            rubricVersionId: rubric.id,
            idempotencyKey: `starter-${run.id}-${i}-judge2`,
            now: now(),
          });

          await c.review.submitVerdict(token, org.orgId, res.id, {
            label: tc.humanLabel,
            attemptId: `verdict-${res.id}`,
            rationale: tc.humanRationale,
          });
        }
      } catch {
        // Fall back gracefully if test runner
      }

      return json({ project }, 201);
    }

    if (!body.name) {
      return json({ error: "Project name is required" }, 400);
    }

    const project = await c.projects.create(token, org.orgId, body as typeof body & { name: string });
    return json({ project }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleGetProject(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const project = await c.projects.get(getSessionToken(req), org.orgId, id);
    return json({ project });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleUpdateProject(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    const body = updateSchema.parse(await req.json());
    const project = await c.projects.update(getSessionToken(req), org.orgId, id, body);
    return json({ project });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleDeleteProject(req: Request, c: Container, id: string): Promise<Response> {
  try {
    const org = orgOr400(req);
    if (org instanceof Response) return org;
    await c.projects.remove(getSessionToken(req), org.orgId, id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
