"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, Check } from "lucide-react";
import { api, type Project } from "@/lib/client/api";
import { Page, PageHeader, Spinner, Card } from "./kit";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", models: "gpt-4o, gpt-4o-mini, …", note: "BYO key" },
  { id: "deepseek", name: "DeepSeek", models: "deepseek-chat, deepseek-reasoner", note: "BYO key" },
  { id: "openrouter", name: "OpenRouter", models: "any OpenRouter model", note: "BYO key" },
  { id: "ollama", name: "Ollama", models: "llama3.1, local models", note: "local, no key" },
];

export function ModelsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<{ projects: Project[] }>("/projects").then((d) => setProjects(d.projects)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Page>
      <PageHeader title="Models" subtitle="Bring-your-own-key providers for the agent under test and the AI judge." />

      <h2 className="mb-3 text-[14px] font-semibold">Supported providers</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {PROVIDERS.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ABC83A]/10 text-[#5e7a00]"><Cpu size={15} /></div>
              <div>
                <div className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{p.name}</div>
                <div className="text-[12px] text-[#8a8f98]">{p.models}</div>
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#5e7a00]"><Check size={12} /> {p.note}</div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-[14px] font-semibold">Per-project default model</h2>
      {loading ? (
        <Spinner />
      ) : projects.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[#8a8f98]">No projects yet.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <Link href={`/projects/${p.id}`} className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] hover:underline">{p.name}</Link>
                <span className="font-mono text-[12px] text-[#8a8f98]">{(p as Project & { defaultModel?: string }).defaultModel ?? "gpt-4o-mini"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
