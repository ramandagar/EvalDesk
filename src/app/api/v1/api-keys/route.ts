import { getRequestContainer } from "@/lib/http/app-container";
import { handleListApiKeys, handleCreateApiKey } from "@/lib/http/api-keys-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleListApiKeys(req, await getRequestContainer());
}
export async function POST(req: Request) {
  return handleCreateApiKey(req, await getRequestContainer());
}
