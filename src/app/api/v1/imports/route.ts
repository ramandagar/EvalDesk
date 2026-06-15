import { getRequestContainer } from "@/lib/http/app-container";
import { handleImport } from "@/lib/http/imports-handler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleImport(req, (await getRequestContainer()));
}
