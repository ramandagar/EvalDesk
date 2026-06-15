import { getRequestContainer } from "@/lib/http/app-container";
import { handleGetTestCase, handleDeleteTestCase } from "@/lib/http/test-cases-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleGetTestCase(req, (await getRequestContainer()), id);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleDeleteTestCase(req, (await getRequestContainer()), id);
}
