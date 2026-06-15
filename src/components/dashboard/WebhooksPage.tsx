"use client";

import { useCallback, useEffect, useState } from "react";
import { Webhook, Plus, Copy, Check } from "lucide-react";
import { api } from "@/lib/client/api";
import { Page, PageHeader, Spinner, EmptyState, ErrorBanner, Card, Button, Field, Input } from "./kit";

interface Hook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
}

const EVENTS = ["run.completed", "run.failed", "regression.detected", "certificate.signed", "verdict.submitted"];

export function WebhooksPage() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>(["certificate.signed", "run.completed"]);
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const { webhooks } = await api.get<{ webhooks: Hook[] }>("/webhooks");
      setHooks(webhooks);
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
    if (!url || selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const { webhook } = await api.post<{ webhook: { id: string; secret: string } }>("/webhooks", { url, events: selected });
      setNewSecret(webhook.secret);
      setUrl("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggle(ev: string) {
    setSelected((s) => (s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev]));
  }

  return (
    <Page>
      <PageHeader
        title="Webhooks"
        subtitle="HMAC-signed event delivery (run.completed, certificate.signed, …)."
        action={<Button onClick={() => setShowForm((s) => !s)}><Plus size={15} /> Add webhook</Button>}
      />
      {error && <ErrorBanner message={error} />}

      {newSecret && (
        <Card className="mb-4 p-4 border-[#ABC83A]/40">
          <p className="text-[13px] font-medium mb-1">Signing secret — copy it now, it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] px-3 py-2 text-[12px] font-mono break-all">{newSecret}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(newSecret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="rounded-lg border border-black/[0.08] dark:border-white/[0.1] p-2"
              title="Copy"
            >
              {copied ? <Check size={14} className="text-[#5e7a00]" /> : <Copy size={14} />}
            </button>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6 p-5">
          <form onSubmit={create} className="space-y-3">
            <Field label="Endpoint URL (https only)">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/evaldesk" required />
            </Field>
            <div>
              <span className="mb-2 block text-[12px] text-[#8a8f98]">Events</span>
              <div className="flex flex-wrap gap-2">
                {EVENTS.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggle(ev)}
                    className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${selected.includes(ev) ? "border-[#ABC83A] bg-[#ABC83A]/10 text-[#5e7a00]" : "border-black/[0.08] dark:border-white/[0.1] text-[#8a8f98]"}`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={saving || !url || selected.length === 0}>{saving ? "Creating…" : "Create webhook"}</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : hooks.length === 0 ? (
        <EmptyState title="No webhooks" hint="Add an endpoint to receive signed events when runs finish or certificates are signed." />
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {hooks.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Webhook size={15} className="mt-0.5 shrink-0 text-[#8a8f98]" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{h.url}</div>
                    <div className="text-[12px] text-[#8a8f98]">{h.events.join(" · ")}</div>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${h.isActive ? "bg-[#ABC83A]/15 text-[#5e7a00]" : "bg-neutral-500/10 text-neutral-500"}`}>
                  {h.isActive ? "active" : "inactive"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
