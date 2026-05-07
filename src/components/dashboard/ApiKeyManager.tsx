"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Loader2, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

interface Props { projectId: string; }

export function ApiKeyManager({ projectId }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/keys?projectId=${projectId}`);
      if (res.ok) setKeys(await res.json());
    } catch {}
    setLoading(false);
  }

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name, permissions: ["read", "write"] }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        toast.success("API key created — copy it now, it won't be shown again");
        setName(""); setShowForm(false); load();
      } else { const err = await res.json(); toast.error(err.error || "Failed"); }
    } catch { toast.error("Failed"); }
    setCreating(false);
  }

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Key revoked"); load(); }
    } catch {}
  }

  async function copyKey() {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
    </div>
  );

  return (
    <div className="space-y-4">
      {newKey && (
        <div className="card p-4 border-[#ABC83A]/30 bg-[#ABC83A]/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">New API Key</p>
            <button onClick={() => setNewKey(null)} className="text-[11px] text-[#8a8f98]">Dismiss</button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-black/[0.03] dark:bg-white/[0.03] p-2 rounded font-mono break-all">{newKey}</code>
            <button onClick={copyKey} className="btn-secondary text-[11px] py-1.5">
              {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <p className="text-[10px] text-amber-500 mt-1">Copy this key now — it won&apos;t be shown again.</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>API Keys</h3>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-[12px] py-1.5">
            <Plus size={13} /> Create
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Key name (e.g. CI/CD)" className="input flex-1" />
            <button onClick={create} disabled={creating || !name.trim()} className="btn-primary text-[12px]">
              {creating ? <Loader2 size={13} className="animate-spin" /> : "Create"}
            </button>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#8a8f98]">No API keys</div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {keys.map(k => (
              <div key={k.id} className="px-5 py-3 flex items-center gap-3">
                <Key size={14} className="text-[#8a8f98]" />
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{k.name}</p>
                  <p className="text-[10px] text-[#8a8f98] font-mono">{k.keyPrefix}•••••••</p>
                </div>
                <span className="text-[10px] text-[#8a8f98]">{new Date(k.createdAt).toLocaleDateString()}</span>
                <button onClick={() => revoke(k.id)} className="text-[#8a8f98] hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
