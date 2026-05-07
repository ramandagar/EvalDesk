"use client";

import { useEffect, useState } from "react";
import { Shield, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface ConfidenceCase {
  testCaseId: string; input: string; title: string; sampleSize: number;
  passCount: number; passRate: number; confidence: { lower: number; upper: number }; confidenceScore: number;
}

interface ConfidenceData {
  overall: {
    sampleSize: number; passCount: number; passRate: number;
    confidence: { lower: number; upper: number }; confidenceScore: number;
  };
  perCase: ConfidenceCase[];
}

interface Props { projectId?: string; }

function ConfidenceMeter({ score }: { score: number }) {
  const color = score >= 70 ? "#4E9363" : score >= 40 ? "#D97706" : "#dc2626";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-semibold min-w-[32px] text-right" style={{ color }}>{score}</span>
    </div>
  );
}

function ConfRange({ lower, upper }: { lower: number; upper: number }) {
  return <span className="text-[10px] text-[#8a8f98]">[{Math.round(lower * 100)}% – {Math.round(upper * 100)}%]</span>;
}

export function ConfidenceScore({ projectId }: Props) {
  const [data, setData] = useState<ConfidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const params = projectId ? `?projectId=${projectId}` : "";
      const res = await fetch(`/api/analytics/confidence${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  if (loading) return (
    <div className="card p-8 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
      <span className="ml-2 text-[13px] text-[#8a8f98]">Computing confidence...</span>
    </div>
  );

  if (!data) return (
    <div className="card p-8 text-center">
      <Shield className="mx-auto h-6 w-6 text-[#8a8f98]" />
      <p className="mt-2 text-[13px] text-[#8a8f98]">No rated results for confidence scoring yet.</p>
    </div>
  );

  const overall = data.overall;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Confidence Score</h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
              Wilson score (95% CI) &middot; {overall.sampleSize} rated samples
            </p>
          </div>
          <div className="text-right">
            <p className="text-[24px] font-semibold" style={{ letterSpacing: "-0.03em", color: overall.confidenceScore >= 70 ? "#4E9363" : overall.confidenceScore >= 40 ? "#D97706" : "#dc2626" }}>
              {overall.confidenceScore}
            </p>
            <ConfRange lower={overall.confidence.lower} upper={overall.confidence.upper} />
          </div>
        </div>
        <div className="mt-3"><ConfidenceMeter score={overall.confidenceScore} /></div>
      </div>

      {data.perCase.length > 0 && (
        <>
          <button onClick={() => setExpanded(!expanded)}
            className="w-full px-5 py-2.5 flex items-center justify-between text-[11px] text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition-colors border-b border-black/[0.04] dark:border-white/[0.04]">
            <span>{data.perCase.length} test case{data.perCase.length !== 1 ? "s" : ""}</span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {expanded && (
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] max-h-64 overflow-y-auto">
              {data.perCase.map((tc) => (
                <div key={tc.testCaseId} className="px-5 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate max-w-[60%]">
                      {tc.title || `Test ${tc.testCaseId.slice(0, 8)}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <ConfRange lower={tc.confidence.lower} upper={tc.confidence.upper} />
                      <span className="text-[10px] text-[#8a8f98]">n={tc.sampleSize}</span>
                    </div>
                  </div>
                  <ConfidenceMeter score={tc.confidenceScore} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
