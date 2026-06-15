"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Run, type Project } from "@/lib/client/api";
import { Page, PageHeader, Spinner, EmptyState, Card, StatusBadge } from "./kit";

export function RunsListPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [projects, setProjects] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ runs }, { projects }] = await Promise.all([
          api.get<{ runs: Run[] }>("/runs"),
          api.get<{ projects: Project[] }>("/projects"),
        ]);
        setRuns(runs);
        setProjects(new Map(projects.map((p) => [p.id, p.name])));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Page><Spinner /></Page>;

  return (
    <Page>
      <PageHeader title="All runs" subtitle="Every evaluation run across your projects." />
      {runs.length === 0 ? (
        <EmptyState title="No runs yet" hint="Open a project and click Run eval." action={<Link href="/projects" className="text-[#5e7a00] hover:underline text-[13px]">Go to projects →</Link>} />
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={r.status} />
                  <Link href={`/runs/${r.id}`} className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] hover:underline truncate">
                    {projects.get(r.projectId) ?? "Project"}
                  </Link>
                  <span className="text-[12px] text-[#8a8f98]">{r.totalCases} cases · {r.passCount}✓ {r.failCount}✗ {r.partialCount}~</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.unratedCount > 0 && <Link href={`/review/${r.id}`} className="text-[13px] text-[#5e7a00] hover:underline">Review</Link>}
                  <Link href={`/runs/${r.id}`} className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]">Report →</Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
