"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { Plus, FolderKanban, Trash2, ArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface Project { id: string; name: string; description: string | null; agentEndpoint: string | null; createdAt: string; testCaseCount: number; runCount: number; lastPassRate: number | null; }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", endpoint: "", apiKey: "", agentType: "custom" });
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  async function load() {
    try { const res = await fetch("/api/projects"); if (res.ok) setProjects(await res.json()); } catch {}
    setLoading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { const p = await res.json(); toast.success("Project created"); setShowCreate(false); setForm({ name: "", description: "", endpoint: "", apiKey: "", agentType: "custom" }); router.push(`/projects/${p.id}`); }
      else toast.error("Failed to create");
    } catch { toast.error("Failed"); }
    setCreating(false);
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project and all its data?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects(projects.filter(p => p.id !== id));
    toast.success("Deleted");
  }

  return (
    <div>
      <DashboardHeader title="Projects" subtitle="Manage your AI agent evaluation projects" />
      <div className="p-5">
        <div className="mb-5 flex justify-end">
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            <Plus size={14} /> New project
          </button>
        </div>
        {showCreate && (
          <form onSubmit={create} className="card p-5 mb-5 space-y-3 border-[#ABC83A]/20 dark:border-[#ABC83A]/15">
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Create project</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Medical Triage Bot" required className="input" /></div>
              <div><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Evaluating triage accuracy" className="input" /></div>
              <div><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Agent type</label>
                <select value={form.agentType} onChange={e => setForm({...form, agentType: e.target.value})} className="input">
                  <option value="custom">Custom API (any endpoint)</option>
                  <option value="openai">OpenAI (GPT-4, GPT-4o)</option>
                  <option value="openrouter">OpenRouter (multi-model)</option>
                  <option value="langchain">LangChain / LangGraph Serve</option>
                </select>
              </div>
              <div><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>API key <span className="opacity-50">(optional)</span></label><input type="password" value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} placeholder={form.agentType === "openai" ? "sk-..." : form.agentType === "openrouter" ? "sk-or-..." : "API key"} className="input" /></div>
              <div className="sm:col-span-2"><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Endpoint URL</label><input value={form.endpoint} onChange={e => setForm({...form, endpoint: e.target.value})} placeholder={form.agentType === "openai" ? "https://api.openai.com/v1/chat/completions" : form.agentType === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://your-agent.com/api/chat"} className="input" /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="btn-primary">{creating ? "Creating..." : "Create project"}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        )}
        {loading ? <div className="flex justify-center py-20"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div> :
        projects.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15">
              <FolderKanban className="h-6 w-6 text-[#ABC83A]" />
            </div>
            <p className="mt-4 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">No projects yet</p>
            <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Create your first project to start evaluating AI agents.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-5"><Plus size={14} /> Create first project</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => (
              <div key={p.id} className="card p-4 card-hover group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15">
                      <FolderKanban className="h-4 w-4 text-[#ABC83A]" />
                    </div>
                    <h3 className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>{p.name}</h3>
                  </div>
                  <button onClick={() => deleteProject(p.id)} className="opacity-0 group-hover:opacity-100 p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-red-400 transition-all duration-150"><Trash2 size={13} /></button>
                </div>
                {p.description && <p className="mt-2.5 text-[12px] text-[#8a8f98] dark:text-[#62666d] line-clamp-2 ml-[42px]">{p.description}</p>}
                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#8a8f98] dark:text-[#62666d] ml-[42px]">
                  <span>{p.testCaseCount || 0} tests</span>
                  <span>{p.runCount || 0} runs</span>
                  {p.lastPassRate !== null && <span className={p.lastPassRate >= 80 ? "text-[#4E9363]" : "text-amber-500"}>{p.lastPassRate}%</span>}
                </div>
                <div className="mt-2.5 flex items-center justify-between ml-[42px]">
                  <span className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{formatRelativeTime(new Date(p.createdAt))}</span>
                  <button onClick={() => router.push(`/projects/${p.id}`)} className="flex items-center gap-1 text-[12px] font-medium text-[#ABC83A] hover:underline">Open <ArrowRight size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
