"use client";

// ReviewWorkspace — the invited expert's rating screen. Keyboard-first
// (1/2/3 verdict, Enter submit+advance, b toggle blind, ? legend), with the
// AI-judge + peer verdicts SERVER-OMITTED in blind mode (the API never sends
// them, so blind is a true statement about the bytes received). Submits one
// idempotent verdict row per item via /api/v1, advancing only on confirmation.

import { useCallback, useEffect, useMemo, useState } from "react";
import { WedgePanels } from "./WedgePanels";

interface ReviewItem {
  resultId: string;
  runId: string;
  input: string;
  expectedOutput: string | null;
  agentResponse: string | null;
  needsHuman: boolean;
  blind: boolean;
  myRating: { label: string; rationale: string | null } | null;
  needsHumanReasons?: string[];
  aiScores?: Array<{ model: string; label: string; score: number | null; confidence: number | null }>;
  peerRatings?: Array<{ reviewerId: string | null; label: string }>;
}

const LABELS = [
  { key: "1", label: "fail", text: "Fail", cls: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20" },
  { key: "2", label: "partial", text: "Partial", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20" },
  { key: "3", label: "pass", text: "Pass", cls: "bg-[#ABC83A]/15 text-[#5e7a00] border-[#ABC83A]/40 hover:bg-[#ABC83A]/25" },
] as const;

async function api(path: string, orgId: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-org-id": orgId, ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

function attemptId(): string {
  return `att_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export function ReviewWorkspace({ runId, blind = false }: { runId: string; blind?: boolean }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [rationale, setRationale] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isBlind, setIsBlind] = useState(blind);
  const [showLegend, setShowLegend] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const me = await api(`/me`, "", {}).catch(async () => {
        // /me needs no org header; call directly
        const r = await fetch("/api/v1/me", { credentials: "include" });
        if (!r.ok) throw new Error("not authenticated");
        return r.json();
      });
      const org = me.activeOrgId ?? me.orgs?.[0]?.id;
      if (!org) throw new Error("no organization for this account");
      setOrgId(org);
      // resolve the run's project (for the calibration/agreement panels on completion)
      await api(`/runs/${runId}`, org)
        .then((r) => setProjectId(r?.run?.projectId ?? null))
        .catch(() => {});
      const { items } = await api(`/runs/${runId}/queue?blind=${isBlind}`, org);
      setItems(items);
      setIdx(0);
      setStatus(items.length ? "ready" : "done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, [runId, isBlind]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = items[idx];

  const submit = useCallback(
    async (label: string) => {
      if (!orgId || !current || status === "submitting") return;
      setStatus("submitting");
      try {
        await api(`/results/${current.resultId}/verdicts`, orgId, {
          method: "POST",
          body: JSON.stringify({ label, attemptId: attemptId(), rationale: rationale || undefined }),
        });
        // advance only after the server confirms
        setRationale("");
        setSelected(null);
        if (idx + 1 >= items.length) setStatus("done");
        else {
          setIdx(idx + 1);
          setStatus("ready");
        }
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    },
    [orgId, current, status, rationale, idx, items.length],
  );

  // Keyboard-first controls (1/2/3 suppressed inside the rationale textarea).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inTextarea = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (e.key === "?") return setShowLegend((s) => !s);
      if (e.key === "b" && !inTextarea) return setIsBlind((b) => !b);
      if (inTextarea) return;
      const hit = LABELS.find((l) => l.key === e.key);
      if (hit) {
        setSelected(hit.label);
        e.preventDefault();
      }
      if (e.key === "Enter" && selected) {
        void submit(selected);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, submit]);

  const progress = useMemo(() => (items.length ? Math.round((idx / items.length) * 100) : 0), [idx, items.length]);

  if (status === "loading") return <Centered>Loading review queue…</Centered>;
  if (status === "error") return <Centered><span className="text-red-600">⚠ {error}</span></Centered>;
  if (status === "done")
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <div className="text-2xl font-semibold mb-2">Queue complete 🎉</div>
            <p className="text-neutral-500 mb-6">All flagged results in this run have a verdict.</p>
            <SignoffBar runId={runId} orgId={orgId!} />
          </div>
          {projectId && orgId ? <WedgePanels projectId={projectId} orgId={orgId} /> : null}
        </div>
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      {/* Header: progress + why-queued + blind toggle */}
      <header className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4">
        <div className="text-sm font-medium">
          Item {idx + 1} <span className="text-neutral-400">/ {items.length}</span>
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div className="h-full bg-[#ABC83A] transition-all" style={{ width: `${progress}%` }} />
        </div>
        {!isBlind && current?.needsHumanReasons?.length ? (
          <div className="flex gap-1">
            {current.needsHumanReasons.map((r) => (
              <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30">
                {r.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        ) : null}
        <button
          onClick={() => setIsBlind((b) => !b)}
          className={`text-xs px-3 py-1 rounded-full border ${isBlind ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" : "border-neutral-300 text-neutral-500"}`}
          title="Toggle blind review (b)"
        >
          {isBlind ? "🙈 Blind" : "👁 Open"}
        </button>
        <button onClick={() => setShowLegend((s) => !s)} className="text-xs text-neutral-400 hover:text-neutral-600" title="Shortcuts (?)">
          ?
        </button>
      </header>

      {showLegend && (
        <div className="px-6 py-2 text-xs text-neutral-500 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <b>1</b> Fail · <b>2</b> Partial · <b>3</b> Pass · <b>Enter</b> submit + next · <b>b</b> blind · <b>?</b> legend
        </div>
      )}

      {/* Body: question / answer side-by-side */}
      <div className="flex-1 grid grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
        <Panel title="Input">
          <p className="whitespace-pre-wrap">{current?.input}</p>
          {current?.expectedOutput ? (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Expected / reference</div>
              <p className="whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">{current.expectedOutput}</p>
            </div>
          ) : null}
        </Panel>
        <Panel title="Agent response">
          <p className="whitespace-pre-wrap">{current?.agentResponse ?? <em className="text-neutral-400">no response</em>}</p>
          {!isBlind && current?.aiScores?.length ? (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">AI judges (for reference)</div>
              <div className="flex flex-wrap gap-2">
                {current.aiScores.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800">
                    {s.model}: <b>{s.label}</b>
                    {s.confidence != null ? ` (${Math.round(s.confidence * 100)}%)` : ""}
                  </span>
                ))}
              </div>
              {current.peerRatings?.length ? (
                <div className="mt-2 text-xs text-neutral-500">
                  Peers: {current.peerRatings.map((p) => p.label).join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>

      {/* Footer: verdict controls */}
      <footer className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Rationale (optional) — 1/2/3 are disabled while typing here"
          className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 resize-none h-16"
        />
        <div className="flex items-center gap-3">
          {LABELS.map((l) => (
            <button
              key={l.label}
              onClick={() => setSelected(l.label)}
              className={`flex-1 px-4 py-3 rounded-lg border font-medium transition ${l.cls} ${selected === l.label ? "ring-2 ring-offset-1 ring-current" : ""}`}
            >
              <span className="text-xs opacity-60 mr-1">{l.key}</span> {l.text}
            </button>
          ))}
          <button
            disabled={!selected || status === "submitting"}
            onClick={() => selected && submit(selected)}
            className="px-6 py-3 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium disabled:opacity-40"
          >
            {status === "submitting" ? "Saving…" : "Submit ⏎"}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-neutral-950 overflow-y-auto p-6">
      <div className="text-xs uppercase tracking-wide text-neutral-400 mb-3">{title}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex items-center justify-center text-neutral-500">{children}</div>;
}

function SignoffBar({ runId, orgId }: { runId: string; orgId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "approved" | "rejected" | "error">("idle");
  async function decide(decision: "approve" | "reject") {
    setState("sending");
    try {
      await api(`/runs/${runId}/signoff`, orgId, { method: "POST", body: JSON.stringify({ decision }) });
      setState(decision === "approve" ? "approved" : "rejected");
    } catch {
      setState("error");
    }
  }
  if (state === "approved") return <p className="text-[#5e7a00] font-medium">✓ Approved — finalizing &amp; signing the certificate…</p>;
  if (state === "rejected") return <p className="text-red-600 font-medium">Rejected — the run will not be signed.</p>;
  return (
    <div className="flex gap-3 justify-center">
      <button onClick={() => decide("approve")} disabled={state === "sending"} className="px-5 py-2.5 rounded-lg bg-[#ABC83A] text-neutral-900 font-medium disabled:opacity-50">
        Approve &amp; sign
      </button>
      <button onClick={() => decide("reject")} disabled={state === "sending"} className="px-5 py-2.5 rounded-lg border border-red-500/40 text-red-600 font-medium disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}
