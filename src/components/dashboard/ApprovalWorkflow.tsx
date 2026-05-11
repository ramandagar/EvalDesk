"use client";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface ApprovalHistory {
  action: string;
  userId: string;
  details: { comment?: string; approvalStatus: string; previousStatus: string } | null;
  createdAt: string;
}

interface ApprovalData {
  runId: string;
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  history: ApprovalHistory[];
}

interface Props {
  runId: string;
  onAction?: (data: { action: string; approvalStatus: string }) => void;
}

const statusConfig: Record<ApprovalStatus, { icon: typeof Clock; color: string; bg: string; border: string; label: string }> = {
  pending: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Pending Review",
  },
  approved: {
    icon: CheckCircle,
    color: "text-[#4E9363]",
    bg: "bg-[#4E9363]/10",
    border: "border-[#4E9363]/20",
    label: "Approved",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "Rejected",
  },
};

export function ApprovalWorkflow({ runId, onAction }: Props) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<ApprovalData | null>(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  useEffect(() => {
    loadApproval();
  }, [runId]);

  async function loadApproval() {
    setLoading(true);
    try {
      const res = await fetch(`/api/eval/approval?runId=${runId}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(action: "approve" | "reject") {
    setActionLoading(true);
    try {
      const res = await fetch("/api/eval/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          action,
          comment: comment || undefined,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        setComment("");
        setShowComment(false);
        loadApproval();
        onAction?.({ action, approvalStatus: result.approvalStatus });
      } else {
        toast.error(result.error || "Action failed");
      }
    } catch {
      toast.error("Failed to submit action");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[#8a8f98] dark:text-[#62666d]">
        <Loader2 size={12} className="animate-spin" />
        Loading approval status...
      </div>
    );
  }

  if (!data) return null;

  const config = statusConfig[data.approvalStatus] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-3">
      {/* Current status badge */}
      <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
        <StatusIcon size={14} className={config.color} />
        <span className={`text-[13px] font-semibold ${config.color}`} style={{ letterSpacing: "-0.01em" }}>
          {config.label}
        </span>
      </div>

      {/* Action buttons (only when pending or rejected) */}
      {(data.approvalStatus === "pending" || data.approvalStatus === "rejected") && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => submitAction("approve")}
              disabled={actionLoading}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-[#4E9363]/10 border border-[#4E9363]/20 text-[#4E9363] font-medium hover:bg-[#4E9363]/20 transition disabled:opacity-50"
            >
              <CheckCircle size={12} />
              Approve
            </button>
            <button
              onClick={() => submitAction("reject")}
              disabled={actionLoading}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 font-medium hover:bg-red-500/20 transition disabled:opacity-50"
            >
              <XCircle size={12} />
              Reject
            </button>
            <button
              onClick={() => setShowComment(!showComment)}
              className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition"
            >
              <MessageSquare size={12} />
              {showComment ? "Hide" : "Comment"}
            </button>
          </div>

          {showComment && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              rows={2}
              className="input resize-none text-[12px]"
            />
          )}
        </div>
      )}

      {/* Approval history */}
      {data.history && data.history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
            History
          </p>
          {data.history.map((entry, i) => {
            const isApprove = entry.action === "run.approved";
            const actionColor = isApprove ? "text-[#4E9363]" : "text-red-500";
            return (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02]"
              >
                {isApprove ? (
                  <CheckCircle size={12} className={`${actionColor} mt-0.5 shrink-0`} />
                ) : (
                  <XCircle size={12} className={`${actionColor} mt-0.5 shrink-0`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-medium ${actionColor}`}>
                    {isApprove ? "Approved" : "Rejected"}
                  </p>
                  {entry.details?.comment && (
                    <p className="text-[11px] text-[#62666d] mt-0.5">{entry.details.comment}</p>
                  )}
                  <p className="text-[10px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
                    {entry.createdAt
                      ? new Date(entry.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unknown date"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
