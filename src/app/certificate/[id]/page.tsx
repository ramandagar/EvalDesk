import { db } from "@/db";
import { certificates, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Shield, CheckCircle, Calendar, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
  if (!cert || !cert.isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#09090b]">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-red-400" />
          <h1 className="mt-4 text-xl font-bold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>Certificate Not Found</h1>
          <p className="mt-2 text-sm text-[#8a8f98] dark:text-[#62666d]">This certificate doesn&apos;t exist or is private.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-[#ABC83A] hover:underline">Back to EvalDesk</Link>
        </div>
      </div>
    );
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, cert.projectId));
  const color = cert.badgeColor || "#ABC83A";
  const passRate = cert.passRate ?? 0;
  const isExpired = cert.expiresAt && new Date(cert.expiresAt) < new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fafafa] to-[#f0f0f0] dark:from-[#09090b] dark:to-[#0f1011] p-6">
      <div className="w-full max-w-2xl">
        {/* Certificate Card */}
        <div className="rounded-2xl border-2 bg-white dark:bg-[#0f1011] shadow-2xl overflow-hidden" style={{ borderColor: color }}>
          {/* Header */}
          <div className="px-8 py-6 text-center" style={{ backgroundColor: `${color}10` }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18` }}>
              <Shield size={32} style={{ color }} />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.04em" }}>Evaluation Certificate</h1>
            <p className="mt-1 text-sm text-[#8a8f98] dark:text-[#62666d]">Issued by EvalDesk</p>
          </div>

          {/* Body */}
          <div className="px-8 py-6 space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>{cert.name}</h2>
              {cert.description && <p className="mt-1 text-sm text-[#8a8f98] dark:text-[#62666d]">{cert.description}</p>}
              {project && <p className="mt-2 text-xs text-[#8a8f98] dark:text-[#62666d]">Project: {project.name}</p>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-4 text-center">
                <p className="text-3xl font-bold" style={{ color, letterSpacing: "-0.04em" }}>{passRate}%</p>
                <p className="mt-1 text-xs text-[#8a8f98] dark:text-[#62666d]">Pass Rate</p>
              </div>
              <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-4 text-center">
                <p className="text-3xl font-bold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.04em" }}>{cert.totalCases || 0}</p>
                <p className="mt-1 text-xs text-[#8a8f98] dark:text-[#62666d]">Test Cases</p>
              </div>
              <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle size={20} className={passRate >= 80 ? "text-emerald-500" : passRate >= 50 ? "text-amber-500" : "text-red-500"} />
                  <span className="text-lg font-bold" style={{ color, letterSpacing: "-0.02em" }}>{passRate >= 80 ? "Passed" : passRate >= 50 ? "Partial" : "Failed"}</span>
                </div>
                <p className="mt-1 text-xs text-[#8a8f98] dark:text-[#62666d]">Status</p>
              </div>
            </div>

            {/* Details */}
            <div className="flex items-center justify-between rounded-lg border border-black/[0.06] dark:border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-[#8a8f98] dark:text-[#62666d]">
                <Calendar size={12} />
                Issued: {cert.createdAt ? new Date(cert.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A"}
              </div>
              {cert.expiresAt && (
                <div className={`text-xs ${isExpired ? "text-red-500 font-medium" : "text-[#8a8f98] dark:text-[#62666d]"}`}>
                  {isExpired ? "Expired" : "Expires"}: {new Date(cert.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-[#8a8f98] dark:text-[#62666d]">
                <FileText size={12} />
                {cert.passCount || 0} passed, {cert.failCount || 0} failed
              </div>
            </div>

            {/* Seal */}
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium" style={{ backgroundColor: `${color}10`, color }}>
                <Shield size={14} />
                Verified by EvalDesk
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ABC83A] hover:underline">
            Powered by EvalDesk <ArrowRight size={12} />
          </Link>
        </div>

        {/* Embed code hint */}
        <div className="mt-6 card p-4">
          <p className="text-xs font-medium text-[#8a8f98] dark:text-[#62666d] mb-2" style={{ letterSpacing: "-0.01em" }}>Embed this certificate:</p>
          <code className="text-[11px] text-[#ABC83A] bg-black/[0.03] dark:bg-white/[0.03] px-2 py-1 rounded block overflow-x-auto">
            {`<iframe src="${typeof window !== "undefined" ? window.location.href : ""}" width="600" height="400" frameborder="0"></iframe>`}
          </code>
        </div>
      </div>
    </div>
  );
}
