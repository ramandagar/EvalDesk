"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, Trash2, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";

interface Schedule {
  id: string;
  cronExpression: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

interface Props { projectId: string; }

export function ScheduleEditor({ projectId }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cron, setCron] = useState("every 6h");

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules?projectId=${projectId}`);
      if (res.ok) setSchedules(await res.json());
    } catch {}
    setLoading(false);
  }

  async function create() {
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, cronExpression: cron }),
      });
      if (res.ok) { toast.success("Schedule created"); setShowForm(false); setCron("every 6h"); load(); }
      else { const err = await res.json(); toast.error(err.error || "Failed"); }
    } catch { toast.error("Failed"); }
  }

  async function deleteSchedule(id: string) {
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Deleted"); load(); }
    } catch {}
  }

  async function toggleSchedule(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      if (res.ok) load();
    } catch {}
  }

  const presets = ["every 1h", "every 6h", "every 12h", "every 1d", "every 1w"];

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Scheduled Runs</h3>
          <p className="text-[12px] text-[#8a8f98] mt-0.5">Automatically run evaluations on a schedule</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-[12px] py-1.5">
          <Plus size={13} /> Add
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] space-y-3">
          <div>
            <label className="block text-[12px] text-[#8a8f98] mb-1">Schedule</label>
            <input value={cron} onChange={e => setCron(e.target.value)} placeholder="every 6h" className="input w-full" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <button key={p} onClick={() => setCron(p)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  cron === p ? "bg-[#ABC83A]/10 text-[#ABC83A]" : "bg-black/[0.03] dark:bg-white/[0.03] text-[#8a8f98]"
                }`}>{p}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary text-[12px]">Create</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-[12px]">Cancel</button>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-[#8a8f98]">No schedules configured</div>
      ) : (
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {schedules.map(s => (
            <div key={s.id} className="px-5 py-3 flex items-center gap-3">
              <Clock size={14} className={s.isActive ? "text-[#ABC83A]" : "text-[#8a8f98]"} />
              <div className="flex-1">
                <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{s.cronExpression}</p>
                <p className="text-[10px] text-[#8a8f98]">
                  {s.lastRunAt ? `Last: ${new Date(s.lastRunAt).toLocaleString()}` : "Never run"}
                </p>
              </div>
              <button onClick={() => toggleSchedule(s.id, s.isActive)} className="text-[#8a8f98] hover:text-[#ABC83A]">
                {s.isActive ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button onClick={() => deleteSchedule(s.id)} className="text-[#8a8f98] hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
