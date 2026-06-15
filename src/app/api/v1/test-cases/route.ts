import { getRequestContainer } from "@/lib/http/app-container";
import { handleListTestCases, handleCreateTestCase } from "@/lib/http/test-cases-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleListTestCases(req, (await getRequestContainer()));
}

export async function POST(req: Request) {
  return handleCreateTestCase(req, (await getRequestContainer()));
}
