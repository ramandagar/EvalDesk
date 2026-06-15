import { getRequestContainer } from "@/lib/http/app-container";
import {
  handleGetProject,
  handleUpdateProject,
  handleDeleteProject,
} from "@/lib/http/projects-handler";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleGetProject(req, (await getRequestContainer()), id);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleUpdateProject(req, (await getRequestContainer()), id);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleDeleteProject(req, (await getRequestContainer()), id);
}
