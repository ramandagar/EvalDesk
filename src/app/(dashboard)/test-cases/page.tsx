"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import Link from "next/link";
import { FileText, FolderKanban } from "lucide-react";

export default function GlobalTestCasesPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center surface-base"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div>;

  const totalCases = projects.reduce((s: number, p: any) => s + (p.testCaseCount || 0), 0);

  return (
    <div>
      <DashboardHeader title="Test Cases" subtitle={`${totalCases} cases across ${projects.length} projects`} />
      <div className="p-5 space-y-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15 shrink-0">
              <FileText className="h-4 w-4 text-[#ABC83A]" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Manage test cases per project</p>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Select a project below to view and edit its test cases.</p>
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15">
              <FileText className="h-6 w-6 text-[#ABC83A]" />
            </div>
            <p className="mt-4 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">No projects yet</p>
            <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Create a project first to add test cases.</p>
            <Link href="/projects" className="mt-4 inline-block text-[12px] font-medium text-[#ABC83A] hover:underline">Go to projects</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p: any) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}/test-cases`}
                className="flex items-center gap-3 card p-3 card-hover"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15 shrink-0">
                  <FolderKanban className="h-4 w-4 text-[#ABC83A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>{p.name}</p>
                  <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{p.description || "No description"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>{p.testCaseCount || 0}</p>
                  <p className="text-[10px] text-[#8a8f98] dark:text-[#62666d]">cases</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
