"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Send, Loader2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Webhook {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: string;
}

interface Delivery {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  createdAt: string;
}

interface Props { projectId: string; }

export function WebhookManager({ projectId }: Props) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["run.completed"]);
  const [secret, setSecret] = useState("");
  const [testing, setTesting] = useState<string | null>(null);

  const eventOptions = ["run.completed", "run.failed", "run.started", "rating.added", "comment.added"];

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks?projectId=${projectId}`);
      if (res.ok) setWebhooks(await res.json());
    } catch {}
    setLoading(false);
  }

  async function create() {
    if (!url) return;
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, url, events, secret: secret || undefined }),
      });
      if (res.ok) {
        toast.success("Webhook created");
        setUrl(""); setSecret(""); setEvents(["run.completed"]); setShowForm(false);
        load();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed");
      }
    } catch { toast.error("Failed"); }
  }

  async function deleteWebhook(id: string) {
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Deleted"); load(); }
    } catch {}
  }

  async function testWebhook(id: string) {
    setTesting(id);
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) toast.success(`Test passed (${data.statusCode})`);
        else toast.error(`Test failed: ${data.error || data.statusCode}`);
      }
    } catch { toast.error("Test failed"); }
    setTesting(null);
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Webhooks</h3>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-[12px] py-1.5">
            <Plus size={13} /> Add
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] space-y-3">
            <div>
              <label className="block text-[12px] text-[#8a8f98] mb-1">Payload URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/webhook" className="input w-full" />
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] mb-1">Events</label>
              <div className="flex flex-wrap gap-2">
                {eventOptions.map(evt => (
                  <button key={evt} onClick={() => setEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt])}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      events.includes(evt) ? "bg-[#ABC83A]/10 text-[#ABC83A]" : "bg-black/[0.03] dark:bg-white/[0.03] text-[#8a8f98]"
                    }`}>
                    {evt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] mb-1">Secret (optional)</label>
              <input value={secret} onChange={e => setSecret(e.target.value)} placeholder="whsec_..." className="input w-full" />
            </div>
            <div className="flex gap-2">
              <button onClick={create} disabled={!url} className="btn-primary text-[12px]">Create</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-[12px]">Cancel</button>
            </div>
          </div>
        )}

        {webhooks.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#8a8f98]">No webhooks configured</div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {webhooks.map(wh => (
              <div key={wh.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full shrink-0 ${wh.isActive ? "bg-[#4E9363]" : "bg-[#8a8f98]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">{wh.url}</p>
                  <p className="text-[10px] text-[#8a8f98]">{JSON.parse(wh.events || "[]").join(", ")}</p>
                </div>
                <button onClick={() => testWebhook(wh.id)} disabled={testing === wh.id} className="text-[#8a8f98] hover:text-[#ABC83A] transition-colors">
                  {testing === wh.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
                <button onClick={() => deleteWebhook(wh.id)} className="text-[#8a8f98] hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
