"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  createdAt: string;
}

interface Props { projectId: string; }

export function AuditLogTable({ projectId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?projectId=${projectId}&limit=50`);
      if (res.ok) setEntries(await res.json());
    } catch {}
    setLoading(false);
  }

  const actionColor: Record<string, string> = {
    create: "text-[#4E9363]",
    update: "text-blue-500",
    delete: "text-red-500",
    approve: "text-[#ABC83A]",
    reject: "text-red-500",
    run: "text-purple-500",
  };

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Audit Log</h3>
        <p className="text-[12px] text-[#8a8f98] mt-0.5">Track all actions in this project</p>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-[#8a8f98]">No audit entries yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                <th className="px-5 py-2 text-left text-[10px] font-medium text-[#8a8f98] uppercase tracking-wider">Action</th>
                <th className="px-5 py-2 text-left text-[10px] font-medium text-[#8a8f98] uppercase tracking-wider">Resource</th>
                <th className="px-5 py-2 text-left text-[10px] font-medium text-[#8a8f98] uppercase tracking-wider">Details</th>
                <th className="px-5 py-2 text-left text-[10px] font-medium text-[#8a8f98] uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {entries.map(e => (
                <tr key={e.id}>
                  <td className="px-5 py-2.5">
                    <span className={`text-[11px] font-medium capitalize ${actionColor[e.action] || "text-[#8a8f98]"}`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="text-[11px] text-[#0a0a0a] dark:text-[#f7f8f8]">{e.resourceType}</span>
                    <span className="text-[10px] text-[#8a8f98] ml-1 font-mono">{e.resourceId?.slice(0, 8)}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="text-[11px] text-[#8a8f98] truncate max-w-[200px] inline-block">{e.details}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="text-[10px] text-[#8a8f98]">{new Date(e.createdAt).toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
