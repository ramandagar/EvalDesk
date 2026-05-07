"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, Shield, Crown } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Props { projectId: string; }

const roles = ["owner", "admin", "editor", "viewer"];

const roleBadge: Record<string, { bg: string; text: string }> = {
  owner: { bg: "bg-amber-500/10", text: "text-amber-500" },
  admin: { bg: "bg-purple-500/10", text: "text-purple-500" },
  editor: { bg: "bg-blue-500/10", text: "text-blue-500" },
  viewer: { bg: "bg-black/[0.03] dark:bg-white/[0.03]", text: "text-[#8a8f98]" },
};

export function RoleSelector({ projectId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/roles?projectId=${projectId}`);
      if (res.ok) setMembers(await res.json());
    } catch {}
    setLoading(false);
  }

  async function updateRole(userId: string, role: string) {
    try {
      const res = await fetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, userId, role }),
      });
      if (res.ok) { toast.success("Role updated"); load(); }
      else { const err = await res.json(); toast.error(err.error || "Failed"); }
    } catch { toast.error("Failed"); }
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Team Members</h3>
        <p className="text-[12px] text-[#8a8f98] mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
      </div>

      {members.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-[#8a8f98]">No team members found</div>
      ) : (
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {members.map(m => (
            <div key={m.id} className="px-5 py-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.04] text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">
                {(m.name || m.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{m.name || m.email}</p>
                <p className="text-[10px] text-[#8a8f98]">{m.email}</p>
              </div>
              {m.role === "owner" ? (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${roleBadge.owner.bg} ${roleBadge.owner.text}`}>
                  <Crown size={10} className="inline mr-0.5" /> Owner
                </span>
              ) : (
                <select value={m.role} onChange={e => updateRole(m.id, e.target.value)}
                  className="text-[11px] bg-black/[0.03] dark:bg-white/[0.03] rounded-md px-2 py-1 border-none outline-none">
                  {roles.filter(r => r !== "owner").map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
