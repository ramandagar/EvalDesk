import type { Container } from "./container";
import { getSessionToken, getOrgId } from "./request";
import { json, errorResponse } from "./responses";
import { getBenchmarkPack, listBenchmarkPacks } from "@/lib/suites/packs";

/** GET /api/v1/benchmarks — public list of available benchmark packs. */
export async function handleListBenchmarks(): Promise<Response> {
  return json({ benchmarks: listBenchmarkPacks() });
}

/** POST /api/v1/projects/:id/benchmarks/:packId — import a benchmark into a project. */
export async function handleImportBenchmark(req: Request, c: Container, projectId: string, packId: string): Promise<Response> {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return json({ error: "X-Org-Id header required" }, 400);
    const pack = getBenchmarkPack(packId);
    if (!pack) return json({ error: "Unknown benchmark pack" }, 404);
    let imported = 0;
    for (const tc of pack.cases) {
      await c.testCases.create(getSessionToken(req), orgId, {
        projectId,
        title: tc.title,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        category: tc.category,
        context: tc.context,
      });
      imported++;
    }
    return json({ benchmark: pack.name, version: pack.version, imported }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
