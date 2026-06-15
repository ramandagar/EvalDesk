export const dynamic = "force-dynamic";

// Public certificate page. The signed certificate is the artifact of record and
// is verified OFFLINE (zero-egress): download the cert JSON and run
// `npx evaldesk verify cert.json`, or fetch it (authenticated) via
// GET /api/v1/runs/{runId}/certificate. This page intentionally reads no DB.
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-semibold mb-3">Evaluation certificate</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Certificate <code>{id}</code> is a cryptographically signed, offline-verifiable record.
      </p>
      <pre className="mt-4 rounded-lg bg-neutral-100 dark:bg-neutral-900 p-4 text-sm overflow-x-auto">npx evaldesk verify cert.json</pre>
      <p className="mt-4 text-sm text-neutral-500">
        The signed JSON bundles the issuer public key, so verification never calls back to EvalDesk.
      </p>
    </div>
  );
}
