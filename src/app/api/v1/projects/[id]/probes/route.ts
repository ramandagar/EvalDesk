import { getRequestContainer } from "@/lib/http/app-container";
import { handleGenerateProbes } from "@/lib/http/probes-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleGenerateProbes(req, await getRequestContainer(), id);
}
