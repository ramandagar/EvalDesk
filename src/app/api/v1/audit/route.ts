import { getRequestContainer } from "@/lib/http/app-container";
import { handleListAudit } from "@/lib/http/audit-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleListAudit(req, await getRequestContainer());
}
