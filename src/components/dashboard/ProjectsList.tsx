"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, ChevronRight } from "lucide-react";
import { api, type Project } from "@/lib/client/api";
import { Page, PageHeader, Spinner, EmptyState, ErrorBanner, Card, Button, Field, Input } from "./kit";

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", agentEndpoint: "", agentApiKey: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { projects } = await api.get<{ projects: Project[] }>("/projects");
      setProjects(projects);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/projects", {
        name: form.name.trim(),
        description: form.description || undefined,
        agentEndpoint: form.agentEndpoint || undefined,
        agentApiKey: form.agentApiKey || undefined,
      });
      setForm({ name: "", description: "", agentEndpoint: "", agentApiKey: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Projects"
        subtitle="Each project is an AI agent you evaluate."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} /> New project
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <Card className="mb-6 p-5">
          <form onSubmit={create} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Project name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Triage Bot" required autoFocus />
              </Field>
              <Field label="Description (optional)">
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Symptom-triage assistant" />
              </Field>
              <Field label="Agent endpoint (optional)">
                <Input value={form.agentEndpoint} onChange={(e) => setForm({ ...form, agentEndpoint: e.target.value })} placeholder="https://your-agent/chat" />
              </Field>
              <Field label="Agent API key (optional)">
                <Input type="password" value={form.agentApiKey} onChange={(e) => setForm({ ...form, agentApiKey: e.target.value })} placeholder="sk-…" />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving ? "Creating…" : "Create project"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          hint="Create your first project to start evaluating an agent."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus size={15} /> New project
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="p-4 hover:border-[#ABC83A]/40 transition-colors cursor-pointer group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ABC83A]/10 text-[#5e7a00]">
                      <FolderKanban size={15} />
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{p.name}</div>
                      <div className="text-[12px] text-[#8a8f98] truncate max-w-[220px]">
                        {p.agentEndpoint ?? "No endpoint configured"}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#8a8f98] group-hover:text-[#ABC83A] transition-colors" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
