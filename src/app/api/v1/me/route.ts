import { getRequestContainer } from "@/lib/http/app-container";
import { handleMe } from "@/lib/http/me-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleMe(req, (await getRequestContainer()));
}
