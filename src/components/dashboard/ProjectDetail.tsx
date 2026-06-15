"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Plus, Trash2, Upload, FileText } from "lucide-react";
import { api, getMe, type Project, type TestCase, type Run } from "@/lib/client/api";
import { WedgePanels } from "@/components/review/WedgePanels";
import { Page, PageHeader, Spinner, EmptyState, ErrorBanner, Card, Button, Field, Input, Textarea, StatusBadge } from "./kit";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"cases" | "runs" | "calibration">("cases");
  const [running, setRunning] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    getMe().then((m) => setOrgId(m.activeOrgId)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [{ project }, { testCases }, { runs }] = await Promise.all([
        api.get<{ project: Project }>(`/projects/${projectId}`),
        api.get<{ testCases: TestCase[] }>(`/test-cases?projectId=${projectId}`),
        api.get<{ runs: Run[] }>(`/runs?projectId=${projectId}`),
      ]);
      setProject(project);
      setCases(testCases);
      setRuns(runs);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll runs while any is in flight so status updates as the worker drains.
  useEffect(() => {
    if (!runs.some((r) => r.status === "queued" || r.status === "running")) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [runs, load]);

  async function runEval() {
    setRunning(true);
    try {
      await api.post("/runs", { projectId });
      setTab("runs");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <Page><Spinner /></Page>;
  if (!project) return <Page><ErrorBanner message={error ?? "Project not found"} /></Page>;

  const canRun = Boolean(project.agentEndpoint) && cases.length > 0;

  return (
    <Page>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]">
        <ArrowLeft size={14} /> Projects
      </Link>
      <PageHeader
        title={project.name}
        subtitle={project.agentEndpoint ?? "No agent endpoint — add one in settings to run live evals."}
        action={
          <Button onClick={runEval} disabled={!canRun || running} title={!canRun ? "Add an endpoint + at least one test case" : ""}>
            <Play size={15} /> {running ? "Starting…" : "Run eval"}
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-black/[0.06] dark:border-white/[0.06]">
        {([["cases", `Test cases (${cases.length})`], ["runs", `Runs (${runs.length})`], ["calibration", "Calibration"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === k ? "border-[#ABC83A] text-[#0a0a0a] dark:text-[#f7f8f8]" : "border-transparent text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cases" ? (
        <TestCasesTab projectId={projectId} cases={cases} onChange={load} setError={setError} />
      ) : tab === "runs" ? (
        <RunsTab runs={runs} />
      ) : orgId ? (
        <WedgePanels projectId={projectId} orgId={orgId} />
      ) : (
        <Spinner />
      )}
    </Page>
  );
}

function TestCasesTab({ projectId, cases, onChange, setError }: { projectId: string; cases: TestCase[]; onChange: () => Promise<void>; setError: (s: string) => void }) {
  const [form, setForm] = useState({ title: "", input: "", expectedOutput: "" });
  const [importData, setImportData] = useState("");
  const [mode, setMode] = useState<"add" | "import" | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.input.trim()) return;
    setBusy(true);
    try {
      await api.post("/test-cases", { projectId, title: form.title, input: form.input, expectedOutput: form.expectedOutput || undefined });
      setForm({ title: "", input: "", expectedOutput: "" });
      setMode(null);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importData.trim()) return;
    setBusy(true);
    try {
      const { result } = await api.post<{ result: { format: string; imported: number } }>("/imports", { projectId, data: importData });
      setImportData("");
      setMode(null);
      await onChange();
      setError(`Imported ${result.imported} cases (${result.format}).`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api.del(`/test-cases/${id}`);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button variant="ghost" onClick={() => setMode(mode === "add" ? null : "add")}><Plus size={14} /> Add case</Button>
        <Button variant="ghost" onClick={() => setMode(mode === "import" ? null : "import")}><Upload size={14} /> Import (DeepEval / Langfuse / OpenAI-Evals)</Button>
      </div>

      {mode === "add" && (
        <Card className="mb-4 p-5">
          <form onSubmit={add} className="space-y-3">
            <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Chest pain triage" required /></Field>
            <Field label="Input (what you send the agent)"><Textarea rows={2} value={form.input} onChange={(e) => setForm({ ...form, input: e.target.value })} placeholder="I have sharp chest pain and shortness of breath" required /></Field>
            <Field label="Expected output (reference, optional)"><Textarea rows={2} value={form.expectedOutput} onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })} placeholder="Advise calling emergency services immediately" /></Field>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add test case"}</Button>
          </form>
        </Card>
      )}

      {mode === "import" && (
        <Card className="mb-4 p-5">
          <form onSubmit={doImport} className="space-y-3">
            <Field label="Paste a dataset (JSON or JSONL — format auto-detected)">
              <Textarea rows={5} value={importData} onChange={(e) => setImportData(e.target.value)} placeholder='{"goldens":[{"input":"…","expected_output":"…"}]}' />
            </Field>
            <Button type="submit" disabled={busy}>{busy ? "Importing…" : "Import"}</Button>
          </form>
        </Card>
      )}

      {cases.length === 0 ? (
        <EmptyState title="No test cases" hint="Add cases manually or import a dataset to evaluate your agent against them." />
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {cases.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <FileText size={15} className="mt-0.5 shrink-0 text-[#8a8f98]" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{c.title}</div>
                    <div className="text-[12px] text-[#8a8f98] truncate">{c.input}</div>
                  </div>
                </div>
                <button onClick={() => remove(c.id)} className="shrink-0 text-[#8a8f98] hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function RunsTab({ runs }: { runs: Run[] }) {
  if (runs.length === 0) return <EmptyState title="No runs yet" hint="Click 'Run eval' to evaluate your agent against the test cases." />;
  return (
    <Card>
      <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
        {runs.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={r.status} />
              <span className="text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8]">{r.totalCases} cases</span>
              <span className="text-[12px] text-[#8a8f98]">
                {r.passCount}✓ · {r.failCount}✗ · {r.partialCount}~ · {r.unratedCount} to review
              </span>
            </div>
            <div className="flex items-center gap-3">
              {r.unratedCount > 0 && (
                <Link href={`/review/${r.id}`} className="text-[13px] font-medium text-[#5e7a00] hover:underline">Review →</Link>
              )}
              {r.status === "signed" && (
                <Link href={`/runs/${r.id}/certificate`} className="text-[13px] font-medium text-indigo-600 hover:underline">Certificate</Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
