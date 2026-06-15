import { getRequestContainer } from "@/lib/http/app-container";
import { handleListProjects, handleCreateProject } from "@/lib/http/projects-handler";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleListProjects(req, (await getRequestContainer()));
}

export async function POST(req: Request) {
  return handleCreateProject(req, (await getRequestContainer()));
}
