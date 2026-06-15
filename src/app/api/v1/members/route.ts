import { getRequestContainer } from "@/lib/http/app-container";
import { handleListMembers, handleAddMember } from "@/lib/http/members-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleListMembers(req, await getRequestContainer());
}
export async function POST(req: Request) {
  return handleAddMember(req, await getRequestContainer());
}
