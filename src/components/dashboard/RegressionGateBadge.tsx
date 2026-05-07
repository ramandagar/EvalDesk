"use client";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";

type GateStatus = "passed" | "failed" | "warning";

interface GateResult {
  status: GateStatus;
  passRate: number | null;
  threshold: number;
  message: string;
  details: {
    totalCases: number;
    passCount: number;
    failCount: number;
    partialCount: number;
    delta: number | null;
  };
}

interface Props {
  runId: string;
  threshold?: number;
  onResult?: (result: GateResult) => void;
}

const statusConfig: Record<GateStatus, { icon: typeof CheckCircle; color: string; bg: string; border: string; label: string }> = {
  passed: {
    icon: CheckCircle,
    color: "text-[#4E9363]",
    bg: "bg-[#4E9363]/10",
    border: "border-[#4E9363]/20",
    label: "Passed",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "Failed",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Warning",
  },
};

export function RegressionGateBadge({ runId, threshold, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GateResult | null>(null);

  useEffect(() => {
    checkGate();
  }, [runId]);

  async function checkGate() {
    setLoading(true);
    try {
      const url = threshold
        ? `/api/eval/gate?runId=${runId}&threshold=${threshold}`
        : `/api/eval/gate?runId=${runId}`;
      const res = await fetch(url);
      const data = await res.json();
      setResult(data);
      onResult?.(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-[#8a8f98] dark:text-[#62666d]">
        <Loader2 size={12} className="animate-spin" />
        Checking gate...
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">
        No gate data
      </div>
    );
  }

  const config = statusConfig[result.status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
      <Icon size={14} className={config.color} />
      <span className={`text-[13px] font-semibold ${config.color}`} style={{ letterSpacing: "-0.01em" }}>
        {config.label}
      </span>
      <span className="text-[11px] text-[#62666d]">
        {result.passRate !== null ? `${result.passRate}%` : "N/A"} / {result.threshold}% threshold
      </span>
    </div>
  );
}
