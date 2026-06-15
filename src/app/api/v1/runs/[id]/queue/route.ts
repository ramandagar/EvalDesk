import { getRequestContainer } from "@/lib/http/app-container";
import { handleReviewQueue } from "@/lib/http/review-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleReviewQueue(req, (await getRequestContainer()), id);
}
