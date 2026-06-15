import { CertificateView } from "@/components/dashboard/CertificateView";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CertificateView runId={id} />;
}
