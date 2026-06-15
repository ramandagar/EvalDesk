import { getRequestContainer } from "@/lib/http/app-container";
import { handleGetRun } from "@/lib/http/runs-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleGetRun(req, (await getRequestContainer()), id);
}
