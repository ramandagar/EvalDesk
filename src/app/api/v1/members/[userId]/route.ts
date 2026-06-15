import { getRequestContainer } from "@/lib/http/app-container";
import { handleUpdateMember, handleRemoveMember } from "@/lib/http/members-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await params;
  return handleUpdateMember(req, await getRequestContainer(), userId);
}
export async function DELETE(req: Request, { params }: Ctx) {
  const { userId } = await params;
  return handleRemoveMember(req, await getRequestContainer(), userId);
}
