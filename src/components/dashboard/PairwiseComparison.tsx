"use client";
import { useState } from "react";
import { Loader2, ArrowLeftRight, Trophy, Minus } from "lucide-react";

interface ComparisonResult {
  winner: "A" | "B" | "tie";
  scoreA: number;
  scoreB: number;
  reasoning: string;
  criteriaScores: Record<string, { a: number; b: number }>;
}

interface Props {
  resultAId: string;
  resultBId: string;
  criteria?: string[];
  responseALabel?: string;
  responseBLabel?: string;
  onResult?: (result: ComparisonResult) => void;
}

function ScoreBar({
  label,
  a,
  b,
}: {
  label: string;
  a: number;
  b: number;
}) {
  const max = Math.max(a, b, 1);
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-[#8a8f98] dark:text-[#62666d] capitalize">{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex justify-end">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(a / max) * 100}%`, maxWidth: "100%" }}
          />
        </div>
        <span className="text-[10px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] w-8 text-center shrink-0">vs</span>
        <div className="flex-1">
          <div
            className="h-2 rounded-full bg-purple-500 transition-all duration-500"
            style={{ width: `${(b / max) * 100}%`, maxWidth: "100%" }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-right text-[11px] font-medium text-blue-500">{a}</span>
        <span className="w-8" />
        <span className="flex-1 text-[11px] font-medium text-purple-500">{b}</span>
      </div>
    </div>
  );
}

export function PairwiseComparison({
  resultAId,
  resultBId,
  criteria,
  responseALabel = "Response A",
  responseBLabel = "Response B",
  onResult,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/eval/comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultAId,
          resultBId,
          criteria,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Comparison failed");
        return;
      }
      setResult(data);
      onResult?.(data);
    } catch {
      setError("Failed to run comparison");
    } finally {
      setLoading(false);
    }
  };

  const winnerColor =
    result?.winner === "A"
      ? "text-blue-500"
      : result?.winner === "B"
        ? "text-purple-500"
        : "text-[#8a8f98] dark:text-[#62666d]";

  const winnerBg =
    result?.winner === "A"
      ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-900/30"
      : result?.winner === "B"
        ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-900/30"
        : "bg-black/[0.02] dark:bg-white/[0.02]";

  return (
    <div className="space-y-3">
      <button
        onClick={runComparison}
        disabled={loading}
        className="btn-primary text-[12px] px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ArrowLeftRight size={14} />
        )}
        {loading ? "Comparing..." : "Compare Side-by-Side"}
      </button>

      {error && (
        <div className="text-[12px] text-red-500 p-2 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Winner badge */}
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${winnerBg}`}>
            {result.winner === "tie" ? (
              <Minus size={16} className={winnerColor} />
            ) : (
              <Trophy size={16} className={winnerColor} />
            )}
            <div className="flex-1">
              <p className={`text-[14px] font-semibold ${winnerColor}`} style={{ letterSpacing: "-0.01em" }}>
                {result.winner === "tie"
                  ? "Tie"
                  : result.winner === "A"
                    ? `${responseALabel} wins`
                    : `${responseBLabel} wins`}
              </p>
              <p className="text-[11px] text-[#62666d] leading-relaxed mt-0.5">
                {result.reasoning}
              </p>
            </div>
          </div>

          {/* Score summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-blue-200/50 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 text-center">
              <p className="text-[10px] text-blue-500 uppercase tracking-wider mb-0.5">{responseALabel}</p>
              <p className="text-[20px] font-semibold text-blue-600" style={{ letterSpacing: "-0.03em" }}>{result.scoreA}</p>
            </div>
            <div className="rounded-lg border border-purple-200/50 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-950/20 p-2.5 text-center">
              <p className="text-[10px] text-purple-500 uppercase tracking-wider mb-0.5">{responseBLabel}</p>
              <p className="text-[20px] font-semibold text-purple-600" style={{ letterSpacing: "-0.03em" }}>{result.scoreB}</p>
            </div>
          </div>

          {/* Per-criteria scores */}
          {Object.keys(result.criteriaScores).length > 0 && (
            <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-blue-500">{responseALabel}</span>
                <span className="font-medium text-purple-500">{responseBLabel}</span>
              </div>
              {Object.entries(result.criteriaScores).map(([key, val]) => (
                <ScoreBar key={key} label={key} a={val.a} b={val.b} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
