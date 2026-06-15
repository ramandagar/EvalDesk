import { handleHealth } from "@/lib/http/health-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleHealth();
}
