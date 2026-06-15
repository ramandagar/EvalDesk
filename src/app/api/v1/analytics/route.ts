import { getRequestContainer } from "@/lib/http/app-container";
import { handleAnalytics } from "@/lib/http/analytics-handler";
export const runtime = "nodejs";
export async function GET(req: Request) {
  return handleAnalytics(req, await getRequestContainer());
}
