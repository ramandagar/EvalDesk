"use client";

import { useState } from "react";
import { Hash, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Props { projectId: string; }

export function SlackConfig({ projectId }: Props) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channel, setChannel] = useState("");
  const [events, setEvents] = useState<string[]>(["run.completed"]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const eventOptions = ["run.completed", "run.failed", "regression.detected", "rating.added"];

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "configure", projectId, webhookUrl, channel, notifyOn: events }),
      });
      if (res.ok) toast.success("Slack config saved");
      else { const err = await res.json(); toast.error(err.error || "Failed"); }
    } catch { toast.error("Failed"); }
    setSaving(false);
  }

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "test", webhookUrl }),
      });
      if (res.ok) toast.success("Test message sent to Slack");
      else toast.error("Test failed");
    } catch { toast.error("Failed"); }
    setTesting(false);
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-[#ABC83A]" />
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Slack Notifications</h3>
        </div>
        <p className="text-[12px] text-[#8a8f98] mt-1">Get evaluation results in your Slack channel</p>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[12px] text-[#8a8f98] mb-1">Slack Webhook URL</label>
          <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..." className="input w-full" />
        </div>

        <div>
          <label className="block text-[12px] text-[#8a8f98] mb-1">Channel (optional)</label>
          <input value={channel} onChange={e => setChannel(e.target.value)}
            placeholder="#eval-results" className="input w-full" />
        </div>

        <div>
          <label className="block text-[12px] text-[#8a8f98] mb-1">Notify On</label>
          <div className="flex flex-wrap gap-2">
            {eventOptions.map(evt => (
              <button key={evt} onClick={() => setEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt])}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  events.includes(evt) ? "bg-[#ABC83A]/10 text-[#ABC83A]" : "bg-black/[0.03] dark:bg-white/[0.03] text-[#8a8f98]"
                }`}>{evt}</button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={save} disabled={saving || !webhookUrl} className="btn-primary text-[12px]">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Save
          </button>
          <button onClick={test} disabled={testing || !webhookUrl} className="btn-secondary text-[12px]">
            {testing ? <Loader2 size={13} className="animate-spin" /> : "Send Test"}
          </button>
        </div>
      </div>
    </div>
  );
}
