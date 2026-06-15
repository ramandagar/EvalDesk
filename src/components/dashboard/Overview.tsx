"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Play, UserCheck, Plus } from "lucide-react";
import { api, getMe, type Project, type Run } from "@/lib/client/api";
import { Page, PageHeader, Spinner, ErrorBanner, Card, Button, StatusBadge } from "./kit";

interface ProjectWithRuns extends Project {
  runs: Run[];
}

export function Overview() {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<ProjectWithRuns[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setEmail(me.user.email);
        const { projects } = await api.get<{ projects: Project[] }>("/projects");
        const withRuns = await Promise.all(
          projects.map(async (p) => {
            const { runs } = await api.get<{ runs: Run[] }>(`/runs?projectId=${p.id}`);
            return { ...p, runs };
          }),
        );
        setData(withRuns);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Page><Spinner /></Page>;

  const allRuns = data.flatMap((p) => p.runs);
  const needsReview = allRuns.reduce((n, r) => n + (r.unratedCount ?? 0), 0);
  const recent = data
    .flatMap((p) => p.runs.map((r) => ({ run: r, project: p })))
    .sort((a, b) => b.run.createdAt - a.run.createdAt)
    .slice(0, 6);

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle={email} action={<Link href="/projects"><Button><Plus size={15} /> New project</Button></Link>} />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat icon={<FolderKanban size={16} />} label="Projects" value={data.length} href="/projects" />
        <Stat icon={<Play size={16} />} label="Total runs" value={allRuns.length} />
        <Stat icon={<UserCheck size={16} />} label="Awaiting review" value={needsReview} accent />
      </div>

      <h2 className="mb-3 text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">Recent runs</h2>
      {recent.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-[#8a8f98]">
          No runs yet. <Link href="/projects" className="text-[#5e7a00] hover:underline">Create a project</Link> and run your first eval.
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {recent.map(({ run, project }) => (
              <li key={run.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={run.status} />
                  <Link href={`/projects/${project.id}`} className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] hover:underline">{project.name}</Link>
                  <span className="text-[12px] text-[#8a8f98]">{run.totalCases} cases · {run.unratedCount} to review</span>
                </div>
                {run.unratedCount > 0 && <Link href={`/review/${run.id}`} className="text-[13px] font-medium text-[#5e7a00] hover:underline">Review →</Link>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}

function Stat({ icon, label, value, href, accent }: { icon: React.ReactNode; label: string; value: number; href?: string; accent?: boolean }) {
  const inner = (
    <Card className={`p-4 ${href ? "hover:border-[#ABC83A]/40 transition-colors cursor-pointer" : ""}`}>
      <div className="flex items-center gap-2 text-[#8a8f98]">{icon}<span className="text-[12px]">{label}</span></div>
      <div className={`mt-1 text-[26px] font-semibold tracking-[-0.02em] ${accent && value > 0 ? "text-[#5e7a00]" : "text-[#0a0a0a] dark:text-[#f7f8f8]"}`}>{value}</div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
