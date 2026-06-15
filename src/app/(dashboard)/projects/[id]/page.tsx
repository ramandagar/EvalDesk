import { ProjectDetail } from "@/components/dashboard/ProjectDetail";
export const dynamic = "force-dynamic";
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
