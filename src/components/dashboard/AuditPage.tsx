"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { Page, PageHeader, Spinner, EmptyState, ErrorBanner, Card } from "./kit";

interface AuditEvent {
  id: string;
  seq: number;
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: unknown;
  prevHash: string;
  hash: string;
  createdAt: number;
}

const ACTION_CLS: Record<string, string> = {
  "verdict.submitted": "text-[#5e7a00]",
  "run.signoff": "text-indigo-600",
  "run.finalized": "text-indigo-600",
  "certificate.issued": "text-[#5e7a00]",
  "api_key.created": "text-[#0a0a0a] dark:text-[#f7f8f8]",
  "api_key.revoked": "text-red-600",
  "member.added": "text-[#5e7a00]",
  "member.role_changed": "text-amber-600",
  "member.removed": "text-red-600",
};

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { events } = await api.get<{ events: AuditEvent[] }>("/audit?limit=200");
      setEvents(events);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <Page>
      <PageHeader
        title="Audit log"
        subtitle="Tamper-evident, hash-chained record of every key action. Each event links to the previous one's hash."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ABC83A]/10 px-2.5 py-1 text-[11px] font-medium text-[#5e7a00]">
            <ShieldCheck size={12} /> hash-chained
          </span>
        }
      />
      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState title="No audit events yet" hint="Sign off a run, create an API key, or invite a member — those actions appear here, cryptographically chained." />
      ) : (
        <Card>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {events.map((e) => {
              const isOpen = open.has(e.id);
              return (
                <li key={e.id}>
                  <button onClick={() => toggle(e.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isOpen ? <ChevronDown size={15} className="shrink-0 text-[#8a8f98]" /> : <ChevronRight size={15} className="shrink-0 text-[#8a8f98]" />}
                      <ScrollText size={14} className="shrink-0 text-[#8a8f98]" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">
                          <span className={ACTION_CLS[e.action] ?? "text-[#0a0a0a] dark:text-[#f7f8f8]"}>{e.action}</span>
                          {e.resourceType && <span className="ml-2 text-[12px] text-[#8a8f98]">{e.resourceType}{e.resourceId ? ` · ${e.resourceId.slice(0, 8)}` : ""}</span>}
                        </div>
                        <div className="text-[11px] text-[#8a8f98]">
                          #{e.seq} · {e.actorId ? `user ${e.actorId.slice(0, 8)}` : "system"} · {new Date(e.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <code className="shrink-0 text-[10px] font-mono text-[#8a8f98]">{e.hash.slice(0, 10)}…</code>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pl-11 space-y-2 text-[12px]">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-[#8a8f98] mb-0.5">Details</div>
                        <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/[0.04] dark:bg-white/[0.04] p-2.5 text-[12px] font-mono">{JSON.stringify(e.details, null, 2)}</pre>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-[#8a8f98] mb-0.5">prev hash</div>
                          <code className="font-mono text-[11px] break-all">{e.prevHash}</code>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-[#8a8f98] mb-0.5">this hash</div>
                          <code className="font-mono text-[11px] break-all">{e.hash}</code>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Page>
  );
}
