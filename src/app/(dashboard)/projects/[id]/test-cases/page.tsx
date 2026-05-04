"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { Plus, FileText, Trash2, Edit3, X, Save, Upload, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TestCase { id: string; title: string; input: string; expectedOutput: string | null; category: string | null; createdAt: string; }

export default function TestCasesPage() {
  const params = useParams();
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [form, setForm] = useState({ title: "", input: "", expectedOutput: "", category: "" });
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [genPrompt, setGenPrompt] = useState("");
  const [genCount, setGenCount] = useState(30);
  const [genCategories, setGenCategories] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => { load(); }, [params.id]);

  async function load() {
    try { const res = await fetch(`/api/test-cases?projectId=${params.id}`); if (res.ok) setCases(await res.json()); } catch {}
    setLoading(false);
  }

  function resetForm() { setForm({ title: "", input: "", expectedOutput: "", category: "" }); setEditingId(null); setShowEditor(false); }

  async function saveCase(e: React.FormEvent) {
    e.preventDefault(); if (!form.input) return; setSaving(true);
    try {
      const url = editingId ? `/api/test-cases/${editingId}` : "/api/test-cases";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, projectId: params.id }) });
      if (res.ok) { toast.success(editingId ? "Updated" : "Added"); resetForm(); load(); }
    } catch { toast.error("Failed"); }
    setSaving(false);
  }

  function editCase(tc: TestCase) { setForm({ title: tc.title, input: tc.input, expectedOutput: tc.expectedOutput || "", category: tc.category || "" }); setEditingId(tc.id); setShowEditor(true); }

  async function deleteCase(id: string) {
    if (!confirm("Delete?")) return;
    await fetch(`/api/test-cases/${id}`, { method: "DELETE" });
    setCases(cases.filter(c => c.id !== id)); toast.success("Deleted");
  }

  async function bulkImport() {
    if (!bulkText.trim()) return; setSaving(true);
    try {
      const lines = bulkText.split("\n").filter(l => l.trim());
      const parsed: { title: string; input: string; expectedOutput: string }[] = [];
      let q = "", a = "";
      for (const line of lines) {
        if (line.match(/^[Qq]:/)) { if (q) parsed.push({ title: q.slice(0, 80), input: q, expectedOutput: a }); q = line.replace(/^[Qq]:\s*/, ""); a = ""; }
        else if (line.match(/^[Aa]:/)) { a = line.replace(/^[Aa]:\s*/, ""); }
        else if (q && !a) q += " " + line.trim(); else if (a) a += " " + line.trim();
      }
      if (q) parsed.push({ title: q.slice(0, 80), input: q, expectedOutput: a });
      if (!parsed.length) { toast.error("No Q:/A: pairs found"); setSaving(false); return; }
      const res = await fetch("/api/test-cases/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: params.id, cases: parsed }) });
      if (res.ok) { toast.success(`Imported ${parsed.length} cases`); setBulkText(""); setShowBulk(false); load(); }
    } catch { toast.error("Failed"); }
    setSaving(false);
  }

  async function generateCases() {
    if (!genPrompt.trim()) { toast.error("Enter a system prompt or description"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/test-cases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: params.id, systemPrompt: genPrompt, count: genCount, categories: genCategories ? genCategories.split(",").map(s => s.trim()) : undefined }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Generated ${data.count} test cases!`); setGenPrompt(""); setGenCategories(""); setShowGenerator(false); load(); }
      else toast.error(data.error || "Generation failed");
    } catch { toast.error("Generation failed"); }
    setGenerating(false);
  }

  const categories = [...new Set(cases.map(c => c.category).filter(Boolean) as string[])];
  const filtered = filterCat ? cases.filter(c => c.category === filterCat) : cases;

  return (
    <div>
      <DashboardHeader title="Test Cases" subtitle="Write questions for your AI agent in plain English" />
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => { resetForm(); setShowEditor(!showEditor); }} className="btn-primary"><Plus size={14} /> Add test case</button>
          <button onClick={() => setShowBulk(!showBulk)} className="btn-secondary"><Upload size={14} /> Bulk import</button>
          <button onClick={() => { setShowGenerator(!showGenerator); setShowBulk(false); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#ABC83A]/30 bg-[#ABC83A]/5 px-4 py-[7px] text-[13px] font-medium text-[#ABC83A] hover:border-[#ABC83A]/50 hover:bg-[#ABC83A]/10 transition-all duration-150"><Sparkles size={14} /> AI generate</button>
          {categories.length > 0 && (
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="ml-auto input !w-auto !py-[7px] text-[13px]">
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        {showEditor && (
          <form onSubmit={saveCase} className="card p-4 mb-4 space-y-3 border-[#ABC83A]/20 dark:border-[#ABC83A]/15">
            <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>{editingId ? "Edit" : "New"} test case</h3><button type="button" onClick={resetForm}><X size={14} className="text-[#8a8f98] dark:text-[#62666d]" /></button></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2"><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Question / Input *</label><textarea value={form.input} onChange={e => setForm({...form, input: e.target.value, title: e.target.value.slice(0, 80)})} placeholder="What should I do if I have chest pain?" rows={3} required className="input resize-none" /></div>
              <div><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Category</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Cardiology" className="input" /></div>
            </div>
            <div><label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Expected answer (reference)</label><textarea value={form.expectedOutput} onChange={e => setForm({...form, expectedOutput: e.target.value})} placeholder="Should recommend calling emergency services..." rows={2} className="input resize-none" /></div>
            <button type="submit" disabled={saving} className="btn-primary"><Save size={14} /> {editingId ? "Update" : "Add"}</button>
          </form>
        )}
        {showBulk && (
          <div className="card p-4 mb-4 space-y-3 border-[#6FA3A5]/20 dark:border-[#6FA3A5]/15">
            <h3 className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Bulk import</h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Use <code className="bg-black/[0.04] dark:bg-white/[0.04] px-1 rounded text-[11px]">Q:</code> for questions and <code className="bg-black/[0.04] dark:bg-white/[0.04] px-1 rounded text-[11px]">A:</code> for expected answers.</p>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"Q: I have chest pain\nA: Call 112 immediately"} rows={5} className="input font-mono text-[12px] resize-none" />
            <div className="flex gap-2">
              <button onClick={bulkImport} disabled={saving} className="btn-primary"><Upload size={14} /> Import</button>
              <button onClick={() => setShowBulk(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}
        {showGenerator && (
          <div className="card p-4 mb-4 space-y-3 border-[#ABC83A]/20 dark:border-[#ABC83A]/15 bg-gradient-to-br from-[#ABC83A]/[0.03] to-transparent dark:from-[#ABC83A]/[0.05]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#ABC83A]" />
                <h3 className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>AI Test Case Generator</h3>
              </div>
              <button type="button" onClick={() => setShowGenerator(false)}><X size={14} className="text-[#8a8f98] dark:text-[#62666d]" /></button>
            </div>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Paste your AI agent&apos;s system prompt or description. We&apos;ll generate edge case test questions automatically.</p>
            <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)} placeholder={"You are a medical triage assistant. Help patients understand their symptoms and recommend next steps. Never diagnose or prescribe medication.\n\nOR just describe what the agent does..."} rows={5} className="input resize-none text-[13px]" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Number of cases</label>
                <select value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="input !w-auto">
                  <option value={10}>10 cases</option>
                  <option value={20}>20 cases</option>
                  <option value={30}>30 cases</option>
                  <option value={50}>50 cases</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Categories (comma separated)</label>
                <input value={genCategories} onChange={e => setGenCategories(e.target.value)} placeholder="safety, accuracy, edge cases" className="input" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={generateCases} disabled={generating || !genPrompt.trim()} className="btn-primary">
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? "Generating..." : `Generate ${genCount} cases`}
              </button>
              <button onClick={() => setShowGenerator(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}
        {loading ? <div className="flex justify-center py-20"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div> :
        filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ABC83A]/10 dark:bg-[#ABC83A]/15">
              <FileText className="h-6 w-6 text-[#ABC83A]" />
            </div>
            <p className="mt-4 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">No test cases yet</p>
            <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Add questions your AI agent should handle.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((tc, i) => (
              <div key={tc.id} className="group flex items-start gap-3 card p-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black/[0.04] dark:bg-white/[0.04] text-[11px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8]">{tc.input}</p>
                  {tc.expectedOutput && <p className="mt-0.5 text-[12px] text-[#8a8f98] dark:text-[#62666d] line-clamp-1">Expected: {tc.expectedOutput}</p>}
                  {tc.category && <span className="mt-1 inline-block rounded-full bg-[#ABC83A]/8 border border-[#ABC83A]/15 px-2 py-0.5 text-[10px] font-medium text-[#ABC83A]">{tc.category}</span>}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-150">
                  <button onClick={() => editCase(tc)} className="p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition"><Edit3 size={13} /></button>
                  <button onClick={() => deleteCase(tc.id)} className="p-1 text-[#8a8f98] dark:text-[#62666d] hover:text-red-400 transition"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
