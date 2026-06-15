export const dynamic = "force-dynamic";

// Public embeddable status badge. The live per-project badge will read a public
// read-only endpoint; for now it renders a static, dependency-free badge so the
// route is stable and never exposes tenant data.
export default async function EmbedPage({ params }: { params: Promise<{ projectId: string }> }) {
  await params;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "12px system-ui", padding: "4px 8px", border: "1px solid #ABC83A", borderRadius: 6 }}>
      <span style={{ fontWeight: 600 }}>EvalDesk</span>
      <span style={{ color: "#5e7a00" }}>verified</span>
    </div>
  );
}
