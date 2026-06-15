import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ blind?: string }>;
}) {
  const { runId } = await params;
  const { blind } = await searchParams;
  return (
    <div className="h-full">
      <ReviewWorkspace runId={runId} blind={blind === "true"} />
    </div>
  );
}
