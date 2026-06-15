import { getRequestContainer } from "@/lib/http/app-container";
import { handleListRuns, handleCreateRun } from "@/lib/http/runs-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleListRuns(req, (await getRequestContainer()));
}

export async function POST(req: Request) {
  return handleCreateRun(req, (await getRequestContainer()));
}
