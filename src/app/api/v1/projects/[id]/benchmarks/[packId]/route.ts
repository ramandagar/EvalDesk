import { getRequestContainer } from "@/lib/http/app-container";
import { handleImportBenchmark } from "@/lib/http/benchmark-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; packId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id, packId } = await params;
  return handleImportBenchmark(req, await getRequestContainer(), id, packId);
}
