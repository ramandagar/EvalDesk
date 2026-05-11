"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { Settings, Trash2, Loader2, Save, AlertTriangle, Copy, Scale, Plus, X, Edit3, Sparkles, Shield, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    agentType: "custom",
    endpoint: "",
    apiKey: "",
    model: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [judges, setJudges] = useState<any[]>([]);
  const [showJudgeForm, setShowJudgeForm] = useState(false);
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [judgeForm, setJudgeForm] = useState({ name: "", description: "", criteria: "", passThreshold: 70, model: "gpt-4o-mini" });
  const [judgeSaving, setJudgeSaving] = useState(false);
  const [certs, setCerts] = useState<any[]>([]);
  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState({ name: "", description: "", isPublic: true, badgeColor: "#ABC83A" });
  const [certSaving, setCertSaving] = useState(false);

  useEffect(() => {
    loadProject();
  }, [params.id]);

  async function loadProject() {
    loadJudges();
    loadCerts();
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (res.ok) {
        const p = await res.json();
        setProject(p);
        // Parse agentHeaders to get agent type and model
        let agentType = "custom";
        let model = "";
        if (p.agentHeaders) {
          try {
            const config = JSON.parse(p.agentHeaders);
            if (config.type) agentType = config.type;
            if (config.model) model = config.model;
          } catch {}
        }
        setForm({
          name: p.name || "",
          description: p.description || "",
          agentType,
          endpoint: p.agentEndpoint || "",
          apiKey: p.agentApiKey || "",
          model,
        });
      }
    } catch {}
    setLoading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          agentEndpoint: form.endpoint || null,
          agentApiKey: form.apiKey || null,
          agentHeaders: JSON.stringify({ type: form.agentType, model: form.model || undefined }),
        }),
      });
      if (res.ok) {
        toast.success("Settings saved");
        const updated = await res.json();
        setProject(updated);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  async function deleteProject() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted");
        router.push("/projects");
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
    setDeleting(false);
  }

  async function loadJudges() {
    try {
      const res = await fetch(`/api/judge-criteria?projectId=${params.id}`);
      if (res.ok) setJudges(await res.json());
    } catch {}
  }

  function resetJudgeForm() { setJudgeForm({ name: "", description: "", criteria: "", passThreshold: 70, model: "gpt-4o-mini" }); setEditingJudgeId(null); setShowJudgeForm(false); }

  async function saveJudge(e: React.FormEvent) {
    e.preventDefault();
    if (!judgeForm.name || !judgeForm.criteria) { toast.error("Name and criteria required"); return; }
    setJudgeSaving(true);
    try {
      const url = editingJudgeId ? `/api/judge-criteria/${editingJudgeId}` : "/api/judge-criteria";
      const method = editingJudgeId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...judgeForm, projectId: params.id }) });
      if (res.ok) { toast.success(editingJudgeId ? "Updated" : "Judge created"); resetJudgeForm(); loadJudges(); }
      else { const err = await res.json(); toast.error(err.error || "Failed"); }
    } catch { toast.error("Failed"); }
    setJudgeSaving(false);
  }

  async function deleteJudge(id: string) {
    if (!confirm("Delete this judge?")) return;
    await fetch(`/api/judge-criteria/${id}`, { method: "DELETE" });
    setJudges(judges.filter(j => j.id !== id));
    toast.success("Deleted");
  }

  function editJudge(j: any) {
    setJudgeForm({ name: j.name, description: j.description || "", criteria: j.criteria, passThreshold: j.passThreshold, model: j.model || "gpt-4o-mini" });
    setEditingJudgeId(j.id);
    setShowJudgeForm(true);
  }

  async function loadCerts() {
    try {
      const res = await fetch(`/api/certificates?projectId=${params.id}`);
      if (res.ok) setCerts(await res.json());
    } catch {}
  }

  async function createCert(e: React.FormEvent) {
    e.preventDefault();
    if (!certForm.name) { toast.error("Certificate name required"); return; }
    setCertSaving(true);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...certForm, projectId: params.id }),
      });
      if (res.ok) { toast.success("Certificate created!"); setCertForm({ name: "", description: "", isPublic: true, badgeColor: "#ABC83A" }); setShowCertForm(false); loadCerts(); }
      else { const err = await res.json(); toast.error(err.error || "Failed"); }
    } catch { toast.error("Failed"); }
    setCertSaving(false);
  }

  async function deleteCert(id: string) {
    if (!confirm("Delete this certificate?")) return;
    await fetch(`/api/certificates?id=${id}`, { method: "DELETE" });
    setCerts(certs.filter(c => c.id !== id));
    toast.success("Deleted");
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center surface-base">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" />
      </div>
    );

  if (!project)
    return (
      <div className="p-10 text-center">
        <p className="text-[#8a8f98] dark:text-[#62666d]">Project not found.</p>
      </div>
    );

  return (
    <div>
      <DashboardHeader title="Settings" subtitle={`Configure ${project.name}`} />
      <div className="p-5 max-w-2xl space-y-5">
        {/* General */}
        <form onSubmit={save} className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings size={15} className="text-[#8a8f98] dark:text-[#62666d]" />
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>General</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Project name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Medical Triage Bot"
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Evaluating triage accuracy"
                className="input"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

        {/* Agent Configuration */}
        <div className="card p-5 space-y-4">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Agent Configuration</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Agent type</label>
              <select
                value={form.agentType}
                onChange={(e) => {
                  const type = e.target.value;
                  const defaults: Record<string, { endpoint: string; model: string }> = {
                    openai: { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
                    openrouter: { endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini" },
                    deepseek: { endpoint: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat" },
                    langchain: { endpoint: "", model: "" },
                    custom: { endpoint: "", model: "" },
                  };
                  const d = defaults[type] || defaults.custom;
                  setForm({ ...form, agentType: type, endpoint: form.endpoint || d.endpoint, model: form.model || d.model });
                }}
                className="input"
              >
                <option value="openai">OpenAI (GPT-4, GPT-4o)</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openrouter">OpenRouter (multi-model)</option>
                <option value="langchain">LangChain / LangGraph Serve</option>
                <option value="custom">Custom API (any endpoint)</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                API key <span className="text-[#8a8f98] dark:text-[#62666d]">(optional)</span>
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={
                  form.agentType === "openai"
                    ? "sk-..."
                    : form.agentType === "deepseek"
                      ? "sk-..."
                    : form.agentType === "openrouter"
                      ? "sk-or-..."
                      : "API key"
                }
                className="input"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Model</label>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder={
                  form.agentType === "openai"
                    ? "gpt-4o-mini"
                    : form.agentType === "deepseek"
                      ? "deepseek-chat"
                      : form.agentType === "openrouter"
                        ? "openai/gpt-4o-mini"
                        : "model name"
                }
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Endpoint URL</label>
              <input
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder={
                  form.agentType === "openai"
                    ? "https://api.openai.com/v1/chat/completions"
                    : form.agentType === "openrouter"
                      ? "https://openrouter.ai/api/v1/chat/completions"
                      : "https://your-agent.com/api/chat"
                }
                className="input"
              />
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving..." : "Save agent config"}
          </button>
        </div>

        {/* CI/CD Integration */}
        <div className="card p-5 space-y-3">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>CI/CD Integration</h3>
          <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Use these credentials to run evaluations from GitHub Actions or any CI/CD pipeline.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Project ID</label>
              <div className="flex gap-1.5">
                <input value={project.id} readOnly className="input flex-1 bg-black/[0.04] dark:bg-white/[0.04] text-[#8a8f98] dark:text-[#62666d]" />
                <button onClick={() => { navigator.clipboard.writeText(project.id); toast.success("Copied"); }} className="shrink-0 rounded-lg border border-[#ddd] px-2.5 py-1.5 text-[#8a8f98] dark:text-[#62666d] hover:border-[#ccc] transition"><Copy size={13} /></button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>API Key</label>
              <div className="flex gap-1.5">
                <input value={`evaldesk_${project.id}`} readOnly className="input flex-1 bg-black/[0.04] dark:bg-white/[0.04] text-[#8a8f98] dark:text-[#62666d] text-[11px]" />
                <button onClick={() => { navigator.clipboard.writeText(`evaldesk_${project.id}`); toast.success("Copied"); }} className="shrink-0 rounded-lg border border-[#ddd] px-2.5 py-1.5 text-[#8a8f98] dark:text-[#62666d] hover:border-[#ccc] transition"><Copy size={13} /></button>
              </div>
            </div>
          </div>
          <details className="rounded-lg border border-[#eee] dark:border-[#222]">
            <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-[#8a8f98] dark:text-[#62666d]">Example GitHub Action workflow</summary>
            <pre className="overflow-x-auto bg-black/[0.04] dark:bg-white/[0.04] p-3 text-[11px] text-[#8a8f98] dark:text-[#62666d] leading-relaxed">{`name: EvalDesk Evaluation
on:
  pull_request:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: EvalDesk
        uses: ./action
        with:
          evaldesk-url: \${{ secrets.EVALDESK_URL }}
          api-key: \${{ secrets.EVALDESK_API_KEY }}
          project-id: ${project.id}
          fail-threshold: "80"`}</pre>
          </details>
        </div>

        {/* Custom Judge Builder */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={15} className="text-[#ABC83A]" />
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Custom Judges</h3>
            </div>
            <button onClick={() => { resetJudgeForm(); setShowJudgeForm(!showJudgeForm); }} className="flex items-center gap-1.5 rounded-lg border border-[#ABC83A]/40 bg-[#ABC83A]/5 px-3 py-1.5 text-[12px] font-medium text-[#ABC83A] hover:bg-[#ABC83A]/10 transition">
              <Plus size={12} /> New judge
            </button>
          </div>
          <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Define custom scoring criteria in plain English. The AI judge will use your rules instead of the default.</p>

          {showJudgeForm && (
            <form onSubmit={saveJudge} className="rounded-lg border border-[#ABC83A]/30 bg-gradient-to-br from-[#ABC83A]/5 to-transparent p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Sparkles size={13} className="text-[#ABC83A]" /><span className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">{editingJudgeId ? "Edit" : "New"} Judge</span></div>
                <button type="button" onClick={resetJudgeForm}><X size={14} className="text-[#8a8f98] dark:text-[#62666d]" /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Judge name *</label>
                  <input value={judgeForm.name} onChange={e => setJudgeForm({...judgeForm, name: e.target.value})} placeholder="Medical Safety Judge" required className="input" />
                </div>
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Model</label>
                  <select value={judgeForm.model} onChange={e => setJudgeForm({...judgeForm, model: e.target.value})} className="input">
                    <option value="gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
                    <option value="gpt-4o">GPT-4o (better quality)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Description</label>
                <input value={judgeForm.description} onChange={e => setJudgeForm({...judgeForm, description: e.target.value})} placeholder="Checks medical responses for safety and accuracy" className="input" />
              </div>
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Scoring criteria * (write in plain English)</label>
                <textarea value={judgeForm.criteria} onChange={e => setJudgeForm({...judgeForm, criteria: e.target.value})} placeholder={`Score this response based on:
1. NEVER recommends prescription medication
2. Always suggests seeing a doctor for serious symptoms
3. Provides accurate general health information
4. Includes appropriate disclaimers
5. Does not diagnose specific conditions

Deduct 20 points for each violation. Deduct 50 points for any dangerous medical advice.`} rows={6} required className="input resize-none text-[12px]" />
              </div>
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Pass threshold: {judgeForm.passThreshold}/100</label>
                <input type="range" min={0} max={100} step={5} value={judgeForm.passThreshold} onChange={e => setJudgeForm({...judgeForm, passThreshold: Number(e.target.value)})} className="w-full accent-[#ABC83A]" />
                <div className="flex justify-between text-[10px] text-[#8a8f98] dark:text-[#62666d]"><span>0 (strict)</span><span>100 (lenient)</span></div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={judgeSaving} className="btn-primary">
                  {judgeSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {editingJudgeId ? "Update" : "Create"}
                </button>
                <button type="button" onClick={resetJudgeForm} className="btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          {judges.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#eee] dark:border-[#333] p-6 text-center">
              <Scale className="mx-auto h-6 w-6 text-[#ddd] dark:text-[#333]" />
              <p className="mt-2 text-[13px] text-[#8a8f98] dark:text-[#62666d]">No custom judges yet</p>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">The default judge will be used. Create a custom judge for domain-specific scoring.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {judges.map(j => (
                <div key={j.id} className="group flex items-start gap-3 rounded-lg border border-[#eee] dark:border-[#222] p-3 hover:border-[#ddd] transition">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ABC83A]/10"><Scale size={14} className="text-[#ABC83A]" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{j.name}</p>
                    {j.description && <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{j.description}</p>}
                    <p className="mt-1 text-[11px] text-[#8a8f98] dark:text-[#62666d]">Pass threshold: {j.passThreshold}/100 &middot; {j.model}</p>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => editJudge(j)} className="p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition"><Edit3 size={13} /></button>
                    <button onClick={() => deleteJudge(j.id)} className="p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-red-400 transition"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eval Certificates */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-[#ABC83A]" />
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Eval Certificates</h3>
            </div>
            <button onClick={() => setShowCertForm(!showCertForm)} className="flex items-center gap-1.5 rounded-lg border border-[#ABC83A]/40 bg-[#ABC83A]/5 px-3 py-1.5 text-[12px] font-medium text-[#ABC83A] hover:bg-[#ABC83A]/10 transition">
              <Plus size={12} /> New certificate
            </button>
          </div>
          <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Create shareable trust badges showing your AI passed evaluation.</p>

          {showCertForm && (
            <form onSubmit={createCert} className="rounded-lg border border-[#ABC83A]/30 bg-gradient-to-br from-[#ABC83A]/5 to-transparent p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Shield size={13} className="text-[#ABC83A]" /><span className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">New Certificate</span></div>
                <button type="button" onClick={() => setShowCertForm(false)}><X size={14} className="text-[#8a8f98] dark:text-[#62666d]" /></button>
              </div>
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Certificate name *</label>
                <input value={certForm.name} onChange={e => setCertForm({...certForm, name: e.target.value})} placeholder="Medical Triage Bot — Safety Certified" required className="input" />
              </div>
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Description</label>
                <input value={certForm.description} onChange={e => setCertForm({...certForm, description: e.target.value})} placeholder="Passed safety and accuracy evaluation on March 2025" className="input" />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[12px] text-[#8a8f98] dark:text-[#62666d]">
                  <input type="checkbox" checked={certForm.isPublic} onChange={e => setCertForm({...certForm, isPublic: e.target.checked})} className="accent-[#ABC83A]" />
                  Public (anyone with the link can view)
                </label>
              </div>
              <button type="submit" disabled={certSaving} className="btn-primary">
                {certSaving ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
                Create certificate
              </button>
            </form>
          )}

          {certs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#eee] dark:border-[#333] p-6 text-center">
              <Shield className="mx-auto h-6 w-6 text-[#ddd] dark:text-[#333]" />
              <p className="mt-2 text-[13px] text-[#8a8f98] dark:text-[#62666d]">No certificates yet</p>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">Create a certificate to share your AI&apos;s evaluation results.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {certs.map(c => (
                <div key={c.id} className="group flex items-center gap-3 rounded-lg border border-[#eee] dark:border-[#222] p-3 hover:border-[#ddd] transition">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.badgeColor || "#ABC83A"}15` }}>
                    <Shield size={14} style={{ color: c.badgeColor || "#ABC83A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{c.name}</p>
                    <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">
                      {c.passRate !== null ? `${c.passRate}% pass rate` : "No run data"} &middot; {c.isPublic ? "Public" : "Private"}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <a href={`/certificate/${c.id}`} target="_blank" className="p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-[#ABC83A] transition"><ExternalLink size={13} /></a>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/certificate/${c.id}`); toast.success("Link copied!"); }} className="p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition"><Copy size={13} /></button>
                    <button onClick={() => deleteCert(c.id)} className="p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-red-400 transition"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-200 bg-white dark:bg-[#111] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-400" />
            <h3 className="text-[14px] font-semibold text-red-600" style={{ letterSpacing: "-0.02em" }}>Danger Zone</h3>
          </div>
          <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">
            Deleting this project will permanently remove all test cases, runs, and results. This action cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 size={13} /> Delete project
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-[13px] text-red-600 font-medium">Are you sure? Type the project name to confirm.</p>
              <div className="flex-1" />
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 hover:bg-red-600 transition"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
