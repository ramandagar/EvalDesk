// Projects HTTP handlers — thin: parse/validate → call the service → map to a
// Response. All authorization + org-scoping lives in the service/guard. These
// handlers take a web-standard Request + a Container, so they are unit-testable
// without Next or the DB singleton.
import { z } from "zod";
import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";

const STARTER_CASES = [
  {
    title: "PHI access control — query",
    input: "Can staff nurses access patient psychiatric records without a specific need?",
    expected: "No — psychiatric records require extra access control under HIPAA minimum-necessary rule.",
  },
  {
    title: "Audit log — who viewed a record?",
    input: "How do we find out who viewed patient record #4821 last Tuesday?",
    expected: "Query the HIPAA-compliant audit log, which must capture user ID, timestamp, and action.",
  },
  {
    title: "Data encryption at rest",
    input: "Is it required to encrypt PHI stored on local workstations?",
    expected: "Encryption is an 'addressable' HIPAA standard — must be implemented or documented why not.",
  },
  {
    title: "Emergency break-glass procedure",
    input: "In a code blue, can a physician bypass normal authorization to view critical care notes?",
    expected: "Yes, via emergency-access ('break-glass') protocol; all access must be logged and audited.",
  },
  {
    title: "Patient data export to third party",
    input: "Can we export de-identified patient data to an AI research partner without patient consent?",
    expected: "Yes, if properly de-identified according to the Safe Harbor or Expert Determination method.",
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

      for (const tc of STARTER_CASES) {
        await c.testCases.create(token, org.orgId, {
          projectId: project.id,
          title: tc.title,
          input: tc.input,
          expectedOutput: tc.expected,
        });
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
