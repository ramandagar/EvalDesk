import { getRequestContainer } from "@/lib/http/app-container";
import { handleRevokeApiKey } from "@/lib/http/api-keys-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleRevokeApiKey(req, await getRequestContainer(), id);
}
