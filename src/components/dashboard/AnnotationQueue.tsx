"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Loader2, UserPlus, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Annotation {
  id: string;
  runResultId: string;
  assignedTo: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
}

interface Props { projectId: string; }

export function AnnotationQueue({ projectId }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/annotations?projectId=${projectId}`);
      if (res.ok) setAnnotations(await res.json());
    } catch {}
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { toast.success("Updated"); load(); }
    } catch {}
  }

  const statusColor: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    completed: "bg-[#4E9363]/10 text-[#4E9363]",
  };

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Annotation Queue</h3>
        <p className="text-[12px] text-[#8a8f98] mt-0.5">{annotations.length} item{annotations.length !== 1 ? "s" : ""} in queue</p>
      </div>

      {annotations.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-[#8a8f98]">No annotations queued</div>
      ) : (
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {annotations.map(a => (
            <div key={a.id} className="px-5 py-3 flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${statusColor[a.status] || "bg-black/[0.03] text-[#8a8f98]"}`}>
                {a.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">Result {a.runResultId?.slice(0, 8)}</p>
                <p className="text-[10px] text-[#8a8f98]">
                  Priority: {a.priority}
                  {a.assignedTo && ` · Assigned: ${a.assignedTo.slice(0, 8)}`}
                </p>
              </div>
              {a.status !== "completed" && (
                <button onClick={() => updateStatus(a.id, "completed")} className="text-[#8a8f98] hover:text-[#4E9363]">
                  <CheckCircle size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
