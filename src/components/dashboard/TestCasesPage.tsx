"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { api, type Project, type TestCase } from "@/lib/client/api";
import { Page, PageHeader, Spinner, EmptyState, Card } from "./kit";

export function TestCasesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ projects: Project[] }>("/projects").then((d) => {
      setProjects(d.projects);
      if (d.projects[0]) setSelected(d.projects[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get<{ testCases: TestCase[] }>(`/test-cases?projectId=${selected}`).then((d) => setCases(d.testCases)).catch(() => setCases([]));
  }, [selected]);

  if (loading) return <Page><Spinner /></Page>;
  if (projects.length === 0) {
    return (
      <Page>
        <PageHeader title="Test cases" />
        <EmptyState title="No projects yet" hint="Create a project first, then add test cases to it." action={<Link href="/projects" className="text-[#5e7a00] hover:underline text-[13px]">Go to projects →</Link>} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Test cases"
        subtitle="Inputs your agent is evaluated against. Manage them inside a project."
        action={
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-3 py-2 text-[13px] outline-none"
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        }
      />
      {cases.length === 0 ? (
        <EmptyState
          title="No test cases in this project"
          hint="Open the project to add cases or import a dataset."
          action={<Link href={`/projects/${selected}`} className="text-[#5e7a00] hover:underline text-[13px]">Open project →</Link>}
        />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] text-[#8a8f98]">{cases.length} cases</span>
            <Link href={`/projects/${selected}`} className="text-[13px] text-[#5e7a00] hover:underline">Manage in project →</Link>
          </div>
          <Card>
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {cases.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 px-4 py-3">
                  <FileText size={15} className="mt-0.5 shrink-0 text-[#8a8f98]" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{c.title}</div>
                    <div className="text-[12px] text-[#8a8f98] truncate">{c.input}</div>
                    {c.expectedOutput && <div className="text-[11px] text-[#62666d] mt-0.5">Expected: {c.expectedOutput}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </Page>
  );
}
