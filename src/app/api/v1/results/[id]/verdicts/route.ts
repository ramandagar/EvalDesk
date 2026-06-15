import { getRequestContainer } from "@/lib/http/app-container";
import { handleSubmitVerdict } from "@/lib/http/review-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleSubmitVerdict(req, (await getRequestContainer()), id);
}
