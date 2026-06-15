import { getRequestContainer } from "@/lib/http/app-container";
import { handleForgotPassword } from "@/lib/http/auth-handler";
export const runtime = "nodejs";
export async function POST(req: Request) { return handleForgotPassword(req, await getRequestContainer()); }
