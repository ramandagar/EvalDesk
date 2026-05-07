import { db } from "@/db";
import { runs, runResults, testCases, projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Shield, CheckCircle, XCircle, MinusCircle, Clock, ArrowRight, BarChart3 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmbedPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-red-400" />
          <h1 className="mt-4 text-xl font-bold text-[#f7f8f8]" style={{ letterSpacing: "-0.03em" }}>Project Not Found</h1>
          <p className="mt-2 text-sm text-[#62666d]">This project doesn&apos;t exist or is private.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-[#ABC83A] hover:underline">Back to EvalDesk</Link>
        </div>
      </div>
    );
  }

  // Get latest completed run
  const [latestRun] = await db
    .select()
    .from(runs)
    .where(eq(runs.projectId, projectId))
    .orderBy(desc(runs.createdAt))
    .limit(1);

  const passRate = latestRun?.passRate ?? null;
  const lastRunDate = latestRun?.createdAt ? new Date(latestRun.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

  // Get domain breakdown from latest run
  let domainScores: Array<{ category: string; pass: number; total: number; passRate: number }> = [];
  if (latestRun) {
    const results = await db
      .select({
        humanRating: runResults.humanRating,
        judgeRating: runResults.judgeRating,
        category: testCases.category,
      })
      .from(runResults)
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(eq(runResults.runId, latestRun.id));

    const categories = new Map<string, { pass: number; total: number }>();
    for (const r of results) {
      const cat = r.category || "Uncategorized";
      const existing = categories.get(cat) || { pass: 0, total: 0 };
      existing.total++;
      if (r.humanRating === "pass" || r.judgeRating === "pass") existing.pass++;
      categories.set(cat, existing);
    }

    domainScores = Array.from(categories.entries())
      .map(([category, { pass, total }]) => ({
        category,
        pass,
        total,
        passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
      }))
      .sort((a, b) => b.passRate - a.passRate);
  }

  const rateColor = passRate !== null
    ? passRate >= 80 ? "#4E9363"
    : passRate >= 60 ? "#D97706"
    : "#dc2626"
    : "#62666d";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#09090b] to-[#0f1011] p-6">
      <div className="w-full max-w-2xl">
        {/* Main card */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0f1011] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 text-center" style={{ background: `${rateColor}08` }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${rateColor}12` }}>
              <Shield size={32} style={{ color: rateColor }} />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-[#f7f8f8]" style={{ letterSpacing: "-0.04em" }}>
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-[#62666d]">Evaluated by EvalDesk</p>
          </div>

          {/* Stats */}
          <div className="px-8 py-6">
            {latestRun ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                    <p className="text-3xl font-bold" style={{ color: rateColor, letterSpacing: "-0.04em" }}>
                      {passRate !== null ? `${passRate}%` : "--"}
                    </p>
                    <p className="mt-1 text-xs text-[#62666d]">Pass Rate</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {passRate !== null && passRate >= 80 && <CheckCircle size={20} className="text-[#4E9363]" />}
                      {passRate !== null && passRate >= 60 && passRate < 80 && <MinusCircle size={20} className="text-amber-500" />}
                      {passRate !== null && passRate < 60 && <XCircle size={20} className="text-red-500" />}
                      <span className="text-lg font-bold text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
                        {passRate !== null ? (passRate >= 80 ? "Passing" : passRate >= 60 ? "Partial" : "Failing") : "N/A"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#62666d]">Status</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock size={16} className="text-[#62666d]" />
                      <span className="text-sm font-semibold text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
                        {latestRun.totalCases}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#62666d]">Test Cases</p>
                  </div>
                </div>

                {/* Run details */}
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-3 mb-6">
                  <div className="flex items-center gap-2 text-xs text-[#62666d]">
                    <BarChart3 size={12} />
                    Latest Run: {latestRun.name || `Run ${latestRun.id.slice(0, 8)}`}
                  </div>
                  {lastRunDate && (
                    <div className="text-xs text-[#62666d]">
                      {lastRunDate}
                    </div>
                  )}
                </div>

                {/* Detailed counts */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                  <div className="text-center p-2 rounded-lg bg-[#4E9363]/10">
                    <p className="text-[16px] font-semibold text-[#4E9363]">{latestRun.passCount}</p>
                    <p className="text-[10px] text-[#62666d]">Pass</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-500/10">
                    <p className="text-[16px] font-semibold text-red-500">{latestRun.failCount}</p>
                    <p className="text-[10px] text-[#62666d]">Fail</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-500/10">
                    <p className="text-[16px] font-semibold text-amber-500">{latestRun.partialCount}</p>
                    <p className="text-[10px] text-[#62666d]">Partial</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-[16px] font-semibold text-[#62666d]">{latestRun.unratedCount}</p>
                    <p className="text-[10px] text-[#62666d]">Unrated</p>
                  </div>
                </div>

                {/* Domain breakdown */}
                {domainScores.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3" style={{ letterSpacing: "-0.02em" }}>
                      Score by Category
                    </h3>
                    <div className="space-y-2">
                      {domainScores.map((d) => {
                        const c = d.passRate >= 80 ? "#4E9363" : d.passRate >= 60 ? "#D97706" : "#dc2626";
                        return (
                          <div key={d.category}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] text-[#d0d6e0]">{d.category}</span>
                              <span className="text-[12px] font-medium" style={{ color: c }}>{d.passRate}%</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ backgroundColor: c, width: `${d.passRate}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="mx-auto h-8 w-8 text-[#62666d]" />
                <p className="mt-3 text-[14px] font-medium text-[#f7f8f8]">No runs yet</p>
                <p className="mt-1 text-[13px] text-[#62666d]">Evaluation data will appear here after the first run.</p>
              </div>
            )}

            {/* Seal */}
            <div className="text-center pt-4">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium bg-[#ABC83A]/10 text-[#ABC83A]">
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
      </div>
    </div>
  );
}
