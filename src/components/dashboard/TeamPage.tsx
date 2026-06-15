"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { Page, PageHeader, Spinner, ErrorBanner, Card, Button, Field, Input } from "./kit";

interface Member {
  userId: string;
  email: string;
  name: string;
  role: string;
  isYou: boolean;
}

const ROLES = ["owner", "admin", "reviewer", "viewer"];

export function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("reviewer");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { members } = await api.get<{ members: Member[] }>("/members");
      setMembers(members);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await api.post("/members", { email: email.trim(), role });
      setEmail("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api.patch(`/members/${userId}`, { role });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(userId: string) {
    try {
      await api.del(`/members/${userId}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Team"
        subtitle="Invite reviewers (doctors, lawyers, experts) and teammates. Roles are enforced server-side."
        action={<Button onClick={() => setShowForm((s) => !s)}><UserPlus size={15} /> Add member</Button>}
      />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <Card className="mb-6 p-5">
          <form onSubmit={add} className="flex items-end gap-3">
            <div className="flex-1"><Field label="Email (must already have an account)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="reviewer@hospital.org" /></Field></div>
            <div><Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-3 py-2 text-[13px]">
                {["admin", "reviewer", "viewer"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field></div>
            <Button type="submit" disabled={saving || !email.trim()}>{saving ? "Adding…" : "Add"}</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ABC83A]/10 text-[#5e7a00] text-[12px] font-semibold">
                    {(m.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{m.email}{m.isYou && <span className="ml-1.5 text-[11px] text-[#8a8f98]">(you)</span>}</div>
                    {m.name && <div className="text-[12px] text-[#8a8f98]">{m.name}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} disabled={m.isYou} className="rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-2 py-1 text-[12px] disabled:opacity-50">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {!m.isYou && <button onClick={() => remove(m.userId)} className="text-[#8a8f98] hover:text-red-500" title="Remove"><Trash2 size={14} /></button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {members.length === 0 && !loading && (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-[#8a8f98]"><Users size={14} /> Just you so far.</div>
      )}
    </Page>
  );
}
