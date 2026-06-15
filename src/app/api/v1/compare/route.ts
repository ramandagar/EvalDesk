import { getRequestContainer } from "@/lib/http/app-container";
import { handleCompare } from "@/lib/http/review-handler";
export const runtime = "nodejs";
export async function GET(req: Request) {
  return handleCompare(req, await getRequestContainer());
}
