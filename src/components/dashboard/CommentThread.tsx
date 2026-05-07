"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  body: string;
  parentId: string | null;
  userId: string;
  createdAt: string;
  runResultId: string | null;
}

interface Props { projectId: string; }

export function CommentThread({ projectId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [runResultId, setRunResultId] = useState("");

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?projectId=${projectId}`);
      if (res.ok) setComments(await res.json());
    } catch {}
    setLoading(false);
  }

  async function submit() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, body, runResultId: runResultId || undefined }),
      });
      if (res.ok) { setBody(""); setRunResultId(""); load(); }
      else { const err = await res.json(); toast.error(err.error || "Failed"); }
    } catch { toast.error("Failed"); }
    setSubmitting(false);
  }

  async function deleteComment(id: string) {
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (res.ok) load();
    } catch {}
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Comments</h3>
          <p className="text-[12px] text-[#8a8f98] mt-0.5">{comments.length} comment{comments.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write a comment..." className="input w-full min-h-[80px] resize-y" />
          <div className="flex items-center gap-3 mt-2">
            <input value={runResultId} onChange={e => setRunResultId(e.target.value)}
              placeholder="Run result ID (optional)" className="input flex-1 text-[11px]" />
            <button onClick={submit} disabled={submitting || !body.trim()} className="btn-primary text-[12px]">
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Post
            </button>
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#8a8f98]">No comments yet</div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {comments.map(c => (
              <div key={c.id} className="px-5 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8]">{c.body}</p>
                    <p className="text-[10px] text-[#8a8f98] mt-1">
                      {new Date(c.createdAt).toLocaleString()}
                      {c.runResultId && ` · Result ${c.runResultId.slice(0, 8)}`}
                    </p>
                  </div>
                  <button onClick={() => deleteComment(c.id)} className="text-[#8a8f98] hover:text-red-500 text-[11px] ml-2">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
