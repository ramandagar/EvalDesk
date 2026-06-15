import { getRequestContainer } from "@/lib/http/app-container";
import { handleLogout } from "@/lib/http/auth-handler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleLogout(req, (await getRequestContainer()));
}
