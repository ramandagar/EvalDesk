"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import Link from "next/link";
import { FileText, Play, BarChart3, ArrowRight, Loader2, ArrowLeftRight, Settings, AlertTriangle, TrendingDown, FlaskConical } from "lucide-react";
import { toast } from "sonner";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runName, setRunName] = useState("");
  const [regression, setRegression] = useState<any>(null);

  useEffect(() => { loadProject(); }, [params.id]);

  async function loadProject() {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (res.ok) setProject(await res.json());
      const regRes = await fetch(`/api/regressions?projectId=${params.id}`);
      if (regRes.ok) {
        const regData = await regRes.json();
        if (regData.regressions?.length > 0) setRegression(regData.regressions[0]);
      }
    } catch {}
    setLoading(false);
  }

  async function triggerRun() {
    if (!project?.agentEndpoint) { toast.error("Set an agent endpoint first"); return; }
    setRunning(true);
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, runName: runName || undefined }) });
      if (res.ok) { const d = await res.json(); toast.success(`Run started: ${d.totalCases} test cases`); setRunName(""); router.push(`/projects/${project.id}/runs`); }
      else { const err = await res.json(); toast.error(err.error || "Failed to start run"); }
    } catch { toast.error("Failed to start run"); }
    setRunning(false);
  }

  if (loading) return <div className="flex h-screen items-center justify-center surface-base"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div>;
  if (!project) return <div className="p-10 text-center"><p className="text-[#8a8f98] dark:text-[#62666d]">Project not found.</p><Link href="/projects" className="text-[12px] text-[#ABC83A] mt-2 inline-block">Back to projects</Link></div>;

  return (
    <div>
      <DashboardHeader title={project.name} subtitle={project.description || undefined} />
      <div className="p-5 space-y-5">
        {/* Navigation cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { href: `/projects/${project.id}/compare`, icon: ArrowLeftRight, color: "#6D75A6", label: "Compare", desc: "Side-by-side runs" },
            { href: `/projects/${project.id}/test-cases`, icon: FileText, color: "#ABC83A", label: "Test Cases", desc: `${project.testCaseCount || 0} cases` },
            { href: `/projects/${project.id}/runs`, icon: Play, color: "#6FA3A5", label: "Runs", desc: `${project.runCount || 0} runs` },
            { href: `/projects/${project.id}/ab-test`, icon: FlaskConical, color: "#A855F7", label: "A/B Test", desc: "Compare prompts" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="card p-4 flex items-center gap-3 group card-hover">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{backgroundColor:`${item.color}15`}}>
                <item.icon className="h-4 w-4" style={{color:item.color}} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>{item.label}</p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">{item.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#8a8f98] dark:text-[#62666d] group-hover:text-[#0a0a0a] dark:group-hover:text-[#f7f8f8] transition" />
            </Link>
          ))}
          <div className="card p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4E9363]/10 dark:bg-[#4E9363]/15 shrink-0"><BarChart3 className="h-4 w-4 text-[#4E9363]" /></div>
            <div><p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Pass Rate</p><p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">{project.lastPassRate !== null ? `${project.lastPassRate}%` : "No data"}</p></div>
          </div>
          <Link href={`/projects/${project.id}/settings`} className="card p-4 flex items-center gap-3 group card-hover">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04] dark:bg-white/[0.04] shrink-0"><Settings className="h-4 w-4 text-[#8a8f98]" /></div>
            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Settings</p><p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Agent config, endpoint</p></div>
            <ArrowRight className="h-4 w-4 text-[#8a8f98] dark:text-[#62666d] group-hover:text-[#0a0a0a] dark:group-hover:text-[#f7f8f8] transition" />
          </Link>
        </div>

        {/* Regression alert */}
        {regression && (
          <Link href={`/projects/${project.id}/compare`} className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-3 hover:border-red-300 transition group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 shrink-0"><TrendingDown size={14} className="text-red-500" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> Regression detected</p>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">
                Pass rate dropped from <span className="font-medium text-[#0a0a0a] dark:text-[#d0d6e0]">{regression.previousPassRate}%</span> to{" "}
                <span className="font-medium text-red-600">{regression.latestPassRate}%</span> in &ldquo;{regression.latestRunName}&rdquo;
              </p>
            </div>
            <span className="text-[18px] font-semibold text-red-500" style={{ letterSpacing: "-0.03em" }}>{regression.delta}%</span>
            <ArrowRight size={14} className="text-[#8a8f98] dark:text-[#62666d] group-hover:text-red-400 transition" />
          </Link>
        )}

        {/* Run evaluation */}
        <div className="card p-4">
          <h3 className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-2" style={{ letterSpacing: "-0.01em" }}>Run evaluation</h3>
          <div className="flex gap-2">
            <input value={runName} onChange={e => setRunName(e.target.value)} placeholder="Run label (optional) — e.g. v2.1 regression" className="input flex-1" />
            <button onClick={triggerRun} disabled={running || !project.agentEndpoint} className="btn-primary">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play size={14} />}
              {running ? "Running..." : "Run now"}
            </button>
          </div>
          {!project.agentEndpoint && <p className="mt-1.5 text-[11px] text-amber-500">Add an agent endpoint URL in settings</p>}
        </div>

        {/* Recent runs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Recent Runs</h3>
            <Link href={`/projects/${project.id}/runs`} className="text-[12px] font-medium text-[#ABC83A] hover:underline">View all</Link>
          </div>
          {(!project.recentRuns || project.recentRuns.length === 0) ? (
            <div className="card p-6 text-center text-[13px] text-[#8a8f98] dark:text-[#62666d]">No runs yet. Add test cases and hit Run.</div>
          ) : (
            <div className="space-y-1.5">
              {project.recentRuns.map((run: any) => (
                <div key={run.id} className="flex items-center gap-2.5 card p-3">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${run.status === "completed" ? "bg-[#4E9363]" : "bg-[#6FA3A5] animate-pulse"}`} />
                  <span className="flex-1 text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] truncate font-medium" style={{ letterSpacing: "-0.01em" }}>{run.name || `Run ${run.id.slice(0, 8)}`}</span>
                  <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{run.totalCases} cases</span>
                  {run.passRate !== null && <span className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{run.passRate}%</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
