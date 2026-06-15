import { getRequestContainer } from "@/lib/http/app-container";
import { handleListWebhooks, handleCreateWebhook } from "@/lib/http/webhooks-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleListWebhooks(req, (await getRequestContainer()));
}

export async function POST(req: Request) {
  return handleCreateWebhook(req, (await getRequestContainer()));
}
