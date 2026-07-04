import { getRequestContainer } from "@/lib/http/app-container";
import { handleDemo } from "@/lib/http/demo-handler";

export const runtime = "nodejs";

export async function GET() {
  return handleDemo(await getRequestContainer());
}
