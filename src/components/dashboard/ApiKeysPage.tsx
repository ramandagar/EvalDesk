"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Copy, Check, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { Page, PageHeader, Spinner, EmptyState, ErrorBanner, Card, Button, Field, Input } from "./kit";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[] | null;
  lastUsedAt: number | null;
  createdAt: number;
}

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const { keys } = await api.get<{ keys: ApiKey[] }>("/api-keys");
      setKeys(keys);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { key } = await api.post<{ key: { key: string } }>("/api-keys", { name: name.trim() });
      setNewKey(key.key);
      setName("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    try {
      await api.del(`/api-keys/${id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Page>
      <PageHeader
        title="API keys"
        subtitle="For the SDK, the GitHub Action, and the REST API. Send as Authorization: Bearer."
        action={<Button onClick={() => setShowForm((s) => !s)}><Plus size={15} /> New key</Button>}
      />
      {error && <ErrorBanner message={error} />}

      {newKey && (
        <Card className="mb-4 p-4 border-[#ABC83A]/40">
          <p className="text-[13px] font-medium mb-1">Copy your key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] px-3 py-2 text-[12px] font-mono break-all">{newKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg border border-black/[0.08] dark:border-white/[0.1] p-2" title="Copy">
              {copied ? <Check size={14} className="text-[#5e7a00]" /> : <Copy size={14} />}
            </button>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6 p-5">
          <form onSubmit={create} className="flex items-end gap-3">
            <div className="flex-1"><Field label="Key name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CI pipeline" autoFocus /></Field></div>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create"}</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : keys.length === 0 ? (
        <EmptyState title="No API keys" hint="Create a key to call EvalDesk from CI or the SDK." />
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <KeyRound size={15} className="text-[#8a8f98]" />
                  <div>
                    <div className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{k.name}</div>
                    <div className="text-[12px] font-mono text-[#8a8f98]">{k.keyPrefix}…</div>
                  </div>
                </div>
                <button onClick={() => revoke(k.id)} className="text-[#8a8f98] hover:text-red-500" title="Revoke"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
