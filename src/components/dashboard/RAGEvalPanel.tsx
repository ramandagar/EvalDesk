"use client";
import { useState } from "react";
import { Loader2, FileSearch } from "lucide-react";

interface RAGScores {
  faithfulness: number;
  relevance: number;
  contextRecall: number;
  overall: number;
  overallScore: number;
  faithfulnessReasoning: string;
  relevanceReasoning: string;
  contextRecallReasoning: string;
}

interface Props {
  runResultId: string;
  context?: string;
  response?: string;
  expectedAnswer?: string;
  onResult?: (result: RAGScores) => void;
}

function ScoreMeter({
  label,
  value,
  reasoning,
}: {
  label: string;
  value: number;
  reasoning: string;
}) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "#4E9363" : pct >= 40 ? "#f59e0b" : "#dc2626";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
          {label}
        </span>
        <span className="text-[13px] font-semibold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {reasoning && (
        <p className="text-[11px] text-[#62666d] leading-relaxed">{reasoning}</p>
      )}
    </div>
  );
}

export function RAGEvalPanel({
  runResultId,
  context,
  response,
  expectedAnswer,
  onResult,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<RAGScores | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runEval = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/eval/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runResultId,
          context,
          response,
          expectedAnswer,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Evaluation failed");
        return;
      }
      setScores(data);
      onResult?.(data);
    } catch (e) {
      setError("Failed to run RAG evaluation");
    } finally {
      setLoading(false);
    }
  };

  const overallPct = scores ? Math.round(scores.overall * 100) : 0;
  const overallColor = scores
    ? overallPct >= 70
      ? "text-[#4E9363]"
      : overallPct >= 40
        ? "text-amber-500"
        : "text-red-500"
    : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={runEval}
          disabled={loading}
          className="btn-primary text-[12px] px-3 py-1.5 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FileSearch size={14} />
          )}
          {loading ? "Evaluating..." : "Run RAG Eval"}
        </button>
      </div>

      {error && (
        <div className="text-[12px] text-red-500 p-2 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30">
          {error}
        </div>
      )}

      {scores && (
        <div className="space-y-3 p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
          {/* Overall score */}
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
              Overall RAG Score
            </span>
            <span className={`text-[20px] font-bold ${overallColor}`} style={{ letterSpacing: "-0.03em" }}>
              {overallPct}
            </span>
          </div>

          {/* Individual metrics */}
          <ScoreMeter
            label="Faithfulness"
            value={scores.faithfulness}
            reasoning={scores.faithfulnessReasoning}
          />
          <ScoreMeter
            label="Relevance"
            value={scores.relevance}
            reasoning={scores.relevanceReasoning}
          />
          <ScoreMeter
            label="Context Recall"
            value={scores.contextRecall}
            reasoning={scores.contextRecallReasoning}
          />
        </div>
      )}
    </div>
  );
}
