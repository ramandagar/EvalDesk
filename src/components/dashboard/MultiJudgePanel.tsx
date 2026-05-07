"use client";
import { useState } from "react";

interface JudgeVote {
  model: string;
  rating: string;
  score: number;
  reasoning: string;
}

interface Props {
  runResultId: string;
  apiKey?: string;
  onResult?: (result: any) => void;
}

export function MultiJudgePanel({ runResultId, apiKey, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [judges, setJudges] = useState<JudgeVote[]>([]);
  const [consensus, setConsensus] = useState<string>("");
  const [consensusScore, setConsensusScore] = useState<number>(0);
  const [agreement, setAgreement] = useState<number>(0);

  const runMultiJudge = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/judge/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runResultId, apiKey }),
      });
      const data = await res.json();
      setJudges(data.judges || []);
      setConsensus(data.consensus);
      setConsensusScore(data.consensusScore);
      setAgreement(data.agreement);
      onResult?.(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const ratingColor = (r: string) => r === "pass" ? "text-[#4E9363]" : r === "fail" ? "text-red-500" : "text-amber-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={runMultiJudge} disabled={loading}
          className="btn-primary text-[12px] px-3 py-1.5 disabled:opacity-50">
          {loading ? "Running 3 judges..." : "Run Multi-Judge"}
        </button>
      </div>

      {judges.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">Consensus:</span>
            <span className={`font-bold ${ratingColor(consensus)}`}>{consensus?.toUpperCase()}</span>
            <span className="text-[#8a8f98]">{consensusScore}/100</span>
            <span className="text-[10px] text-[#62666d]">({Math.round(agreement * 100)}% agreement)</span>
          </div>
          {judges.map((j, i) => (
            <div key={i} className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#8a8f98]">{j.model}</span>
                <span className={`font-medium ${ratingColor(j.rating)}`}>{j.rating} ({j.score})</span>
              </div>
              <p className="text-[11px] text-[#62666d] mt-1">{j.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
