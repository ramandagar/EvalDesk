import { getRequestContainer } from "@/lib/http/app-container";
import { handleResetPassword } from "@/lib/http/auth-handler";
export const runtime = "nodejs";
export async function POST(req: Request) { return handleResetPassword(req, await getRequestContainer()); }
