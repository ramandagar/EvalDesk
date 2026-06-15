import { getRequestContainer } from "@/lib/http/app-container";
import { handleAuth } from "@/lib/http/auth-handler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleAuth(req, (await getRequestContainer()));
}
