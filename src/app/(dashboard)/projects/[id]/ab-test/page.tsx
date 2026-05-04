"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { FlaskConical, Plus, X, Loader2, Trophy, ArrowLeftRight, CheckCircle, XCircle, Minus } from "lucide-react";
import { toast } from "sonner";

interface ABTest {
  id: string;
  name: string;
  promptA: string;
  promptB: string;
  modelA: string;
  modelB: string;
  status: string;
  resultsA: string | null;
  resultsB: string | null;
  summary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function ABTestPage() {
  const params = useParams();
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", promptA: "", promptB: "", modelA: "gpt-4o-mini", modelB: "gpt-4o-mini" });
  const [saving, setSaving] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => { loadTests(); }, [params.id]);

  async function loadTests() {
    try {
      const res = await fetch(`/api/ab-test?projectId=${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setTests(data);
        if (data.some((t: ABTest) => t.status === "running")) {
          setPolling(true);
          setTimeout(loadTests, 3000);
        } else {
          setPolling(false);
        }
      }
    } catch {}
    setLoading(false);
  }

  async function createTest(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.promptA || !form.promptB) { toast.error("All fields required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, projectId: params.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("A/B test started! Results will appear in ~30 seconds.");
        setShowForm(false);
        setForm({ name: "", promptA: "", promptB: "", modelA: "gpt-4o-mini", modelB: "gpt-4o-mini" });
        setPolling(true);
        setTimeout(loadTests, 3000);
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Failed"); }
    setSaving(false);
  }

  function viewResults(test: ABTest) {
    if (test.status !== "completed") return;
    setSelectedTest(selectedTest?.id === test.id ? null : test);
  }

  const summary = selectedTest?.summary ? JSON.parse(selectedTest.summary) : null;
  const resultsA = selectedTest?.resultsA ? JSON.parse(selectedTest.resultsA) : [];
  const resultsB = selectedTest?.resultsB ? JSON.parse(selectedTest.resultsB) : [];

  return (
    <div>
      <DashboardHeader title="A/B Testing" subtitle="Compare two prompts against the same test cases" />
      <div className="p-5 space-y-5">
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={14} /> New A/B test
          </button>
          {polling && (
            <div className="flex items-center gap-2 text-[12px] text-[#8a8f98] dark:text-[#62666d]">
              <Loader2 size={12} className="animate-spin text-[#ABC83A]" /> Running tests...
            </div>
          )}
        </div>

        {showForm && (
          <form onSubmit={createTest} className="card p-4 space-y-3 border-[#ABC83A]/20 dark:border-[#ABC83A]/15 bg-gradient-to-br from-[#ABC83A]/[0.03] to-transparent dark:from-[#ABC83A]/[0.05]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><FlaskConical size={16} className="text-[#ABC83A]" /><h3 className="text-[13px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>New A/B Test</h3></div>
              <button type="button" onClick={() => setShowForm(false)}><X size={14} className="text-[#8a8f98] dark:text-[#62666d]" /></button>
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Test name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="v2 vs v3 system prompt" required className="input" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-[12px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Prompt A</span>
                </div>
                <select value={form.modelA} onChange={e => setForm({...form, modelA: e.target.value})} className="input">
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                </select>
                <textarea value={form.promptA} onChange={e => setForm({...form, promptA: e.target.value})} placeholder="You are a helpful assistant..." rows={6} required className="input resize-none text-[12px]" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <span className="text-[12px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Prompt B</span>
                </div>
                <select value={form.modelB} onChange={e => setForm({...form, modelB: e.target.value})} className="input">
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                </select>
                <textarea value={form.promptB} onChange={e => setForm({...form, promptB: e.target.value})} placeholder="You are a knowledgeable AI assistant focused on accuracy..." rows={6} required className="input resize-none text-[12px]" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
              {saving ? "Starting..." : "Run A/B test"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" /></div>
        ) : tests.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#A855F7]/10 dark:bg-[#A855F7]/15">
              <FlaskConical className="h-6 w-6 text-[#A855F7]" />
            </div>
            <p className="mt-4 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">No A/B tests yet</p>
            <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Compare two prompts to find which one performs better.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(test => (
              <div key={test.id}>
                <button onClick={() => viewResults(test)} className="w-full card p-4 text-left card-hover">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${test.status === "completed" ? "bg-[#ABC83A]/10" : "bg-amber-500/10"}`}>
                      {test.status === "running" ? <Loader2 size={14} className="animate-spin text-amber-500" /> :
                       test.status === "completed" ? <Trophy size={14} className="text-[#ABC83A]" /> :
                       <XCircle size={14} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>{test.name}</p>
                      <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">
                        {test.status === "running" ? "Running..." : test.status === "completed" ? "Completed" : "Failed"}
                        {test.summary && ` — ${JSON.parse(test.summary).totalCases} cases tested`}
                      </p>
                    </div>
                    {test.status === "completed" && (
                      <ArrowLeftRight size={14} className="text-[#8a8f98] dark:text-[#62666d]" />
                    )}
                  </div>
                </button>

                {selectedTest?.id === test.id && summary && (
                  <div className="mt-2 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-center">
                        <p className="text-[18px] font-semibold text-blue-600" style={{ letterSpacing: "-0.03em" }}>{summary.avgScoreA}</p>
                        <p className="text-[10px] text-blue-500">Avg Score A</p>
                      </div>
                      <div className="rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 p-3 text-center">
                        <p className="text-[18px] font-semibold text-purple-600" style={{ letterSpacing: "-0.03em" }}>{summary.avgScoreB}</p>
                        <p className="text-[10px] text-purple-500">Avg Score B</p>
                      </div>
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-center">
                        <p className="text-[18px] font-semibold text-blue-600" style={{ letterSpacing: "-0.03em" }}>{summary.winsA}</p>
                        <p className="text-[10px] text-blue-500">Wins A</p>
                      </div>
                      <div className="rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 p-3 text-center">
                        <p className="text-[18px] font-semibold text-purple-600" style={{ letterSpacing: "-0.03em" }}>{summary.winsB}</p>
                        <p className="text-[10px] text-purple-500">Wins B</p>
                      </div>
                      <div className={`rounded-lg border p-3 text-center ${summary.winner === "tie" ? "card" : summary.winner === "A" ? "border-blue-200 dark:border-blue-900/40" : "border-purple-200 dark:border-purple-900/40"}`}>
                        <p className={`text-[18px] font-semibold ${summary.winner === "A" ? "text-blue-600" : summary.winner === "B" ? "text-purple-600" : "text-[#8a8f98] dark:text-[#62666d]"}`} style={{ letterSpacing: "-0.03em" }}>{summary.winner === "tie" ? "Tie" : `${summary.winner} wins`}</p>
                        <p className="text-[10px] text-[#8a8f98] dark:text-[#62666d]">Result</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {resultsA.map((ra: any, i: number) => {
                        const rb = resultsB[i];
                        const winner = ra.winner;
                        return (
                          <details key={i} className="card overflow-hidden">
                            <summary className="flex items-center gap-2 p-2.5 cursor-pointer text-[12px]">
                              {winner === "a" ? <CheckCircle size={12} className="text-blue-500" /> :
                               winner === "b" ? <CheckCircle size={12} className="text-purple-500" /> :
                               <Minus size={12} className="text-[#8a8f98] dark:text-[#62666d]" />}
                              <span className="flex-1 truncate text-[#0a0a0a] dark:text-[#f7f8f8]">{ra.input}</span>
                              <span className="text-blue-500 font-medium">{ra.score}</span>
                              <span className="text-[#8a8f98] dark:text-[#62666d]">vs</span>
                              <span className="text-purple-500 font-medium">{rb?.score || 0}</span>
                            </summary>
                            <div className="grid grid-cols-2 gap-px bg-black/[0.06] dark:bg-white/[0.06] border-t border-black/[0.06] dark:border-white/[0.06]">
                              <div className="bg-white dark:bg-[#0f1011] p-2.5">
                                <p className="text-[10px] text-blue-500 uppercase tracking-wider mb-1">Prompt A ({ra.score}/100)</p>
                                <p className="text-[11px] text-[#8a8f98] dark:text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">{ra.response}</p>
                              </div>
                              <div className="bg-white dark:bg-[#0f1011] p-2.5">
                                <p className="text-[10px] text-purple-500 uppercase tracking-wider mb-1">Prompt B ({rb?.score || 0}/100)</p>
                                <p className="text-[11px] text-[#8a8f98] dark:text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">{rb?.response || "No response"}</p>
                              </div>
                            </div>
                            {ra.reasoning && (
                              <div className="px-2.5 py-2 text-[11px] text-[#8a8f98] dark:text-[#62666d] border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
                                Judge: {ra.reasoning}
                              </div>
                            )}
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
