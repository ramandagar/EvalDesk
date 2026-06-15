import { RunReport } from "@/components/dashboard/RunReport";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunReport runId={id} />;
}
