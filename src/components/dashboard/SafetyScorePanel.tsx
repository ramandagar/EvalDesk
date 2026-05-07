"use client";
import { useState } from "react";

interface SafetyResult {
  toxicity: number;
  hallucination: number;
  bias: number;
  overallSafety: number;
  flaggedIssues: string[];
  isFlagged: boolean;
}

interface Props {
  runResultId: string;
  apiKey?: string;
  onResult?: (result: SafetyResult) => void;
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#8a8f98]">{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function SafetyScorePanel({ runResultId, apiKey, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SafetyResult | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/judge/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runResultId, apiKey }),
      });
      const data = await res.json();
      setResult(data);
      onResult?.(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={run} disabled={loading}
        className="btn-secondary text-[12px] px-3 py-1.5 disabled:opacity-50">
        {loading ? "Scoring..." : "Safety Check"}
      </button>

      {result && (
        <div className="space-y-2 p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
          <Meter label="Toxicity" value={result.toxicity} color={result.toxicity > 0.5 ? "#dc2626" : "#4E9363"} />
          <Meter label="Hallucination" value={result.hallucination} color={result.hallucination > 0.5 ? "#dc2626" : "#4E9363"} />
          <Meter label="Bias" value={result.bias} color={result.bias > 0.5 ? "#dc2626" : "#4E9363"} />
          <div className="pt-1 text-[11px] text-[#8a8f98]">
            Overall Safety: <span className={result.overallSafety >= 0.8 ? "text-[#4E9363]" : result.overallSafety >= 0.5 ? "text-amber-500" : "text-red-500"}>
              {Math.round(result.overallSafety * 100)}%
            </span>
          </div>
          {result.flaggedIssues?.length > 0 && (
            <div className="pt-1 space-y-0.5">
              {result.flaggedIssues.map((issue, i) => (
                <div key={i} className="text-[10px] text-red-500">! {issue}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
