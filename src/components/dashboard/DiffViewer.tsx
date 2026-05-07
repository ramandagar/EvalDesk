"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Clock, CheckCircle, XCircle, MinusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DiffViewerProps {
  testCaseId: string;
  runAId: string;
  runBId: string;
  runAName?: string | null;
  runBName?: string | null;
}

interface DiffSegment {
  type: "same" | "added" | "removed";
  value: string;
}

interface DiffData {
  testCase: {
    id: string;
    title: string;
    input: string;
    expectedOutput: string | null;
    category: string | null;
  };
  runA: { id: string; name: string | null; createdAt: string | null } | null;
  runB: { id: string; name: string | null; createdAt: string | null } | null;
  resultA: {
    id: string;
    agentResponse: string | null;
    responseTime: number | null;
    status: string;
    errorMessage: string | null;
    humanRating: string | null;
    judgeRating: string | null;
    judgeScore: number | null;
  } | null;
  resultB: {
    id: string;
    agentResponse: string | null;
    responseTime: number | null;
    status: string;
    errorMessage: string | null;
    humanRating: string | null;
    judgeRating: string | null;
    judgeScore: number | null;
  } | null;
  diff: DiffSegment[];
}

const ratingBadge: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  fail: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function DiffViewer({ testCaseId, runAId, runBId, runAName, runBName }: DiffViewerProps) {
  const [data, setData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiff();
  }, [testCaseId, runAId, runBId]);

  async function loadDiff() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/diff?testCaseId=${testCaseId}&runA=${runAId}&runB=${runBId}`
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to load diff");
      }
    } catch {
      toast.error("Failed to load diff");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
        <span className="ml-2 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Loading diff...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <ArrowLeftRight className="mx-auto h-6 w-6 text-[#8a8f98] dark:text-[#62666d]" />
        <p className="mt-2 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Failed to load comparison</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Test case header */}
      <div className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
              {data.testCase.title || `Test Case ${data.testCase.id.slice(0, 8)}`}
            </h3>
            {data.testCase.category && (
              <span className="inline-block mt-1 text-[11px] bg-black/[0.04] dark:bg-white/[0.04] px-2 py-0.5 rounded text-[#8a8f98] dark:text-[#62666d]">
                {data.testCase.category}
              </span>
            )}
          </div>
          {data.testCase.expectedOutput && (
            <div className="text-[12px] text-[#8a8f98] dark:text-[#62666d] max-w-[50%] text-right">
              <span className="font-medium">Expected:</span> {data.testCase.expectedOutput.slice(0, 200)}
              {data.testCase.expectedOutput.length > 200 ? "..." : ""}
            </div>
          )}
        </div>
        <p className="mt-2 text-[12px] text-[#8a8f98] dark:text-[#62666d] whitespace-pre-wrap bg-black/[0.02] dark:bg-white/[0.02] rounded-lg p-2.5">
          {data.testCase.input}
        </p>
      </div>

      {/* Side-by-side diff */}
      <div className="grid grid-cols-2 gap-px bg-black/[0.06] dark:bg-white/[0.06] rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
        {/* Run A */}
        <div className="bg-white dark:bg-[#0f1011]">
          <div className="px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider font-medium">Run A</p>
              <p className="text-[12px] text-[#0a0a0a] dark:text-[#f7f8f8] mt-0.5">
                {runAName || data.runA?.name || `Run ${runAId.slice(0, 8)}`}
              </p>
            </div>
            {data.resultA && (
              <div className="flex items-center gap-2">
                {data.resultA.humanRating && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ratingBadge[data.resultA.humanRating] || ""}`}>
                    {data.resultA.humanRating}
                  </span>
                )}
                {data.resultA.judgeScore !== null && (
                  <span className="text-[10px] text-[#8a8f98] dark:text-[#62666d]">{data.resultA.judgeScore}/100</span>
                )}
              </div>
            )}
          </div>
          <div className="p-4 min-h-[120px]">
            {data.resultA ? (
              <>
                {data.resultA.status === "error" ? (
                  <p className="text-[12px] text-red-500">{data.resultA.errorMessage || "Error"}</p>
                ) : (
                  <p className="text-[12px] text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">
                    {highlightDiff(data.diff, "removed")}
                  </p>
                )}
                {data.resultA.responseTime && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[#8a8f98] dark:text-[#62666d]">
                    <Clock className="h-3 w-3" /> {data.resultA.responseTime}ms
                  </div>
                )}
              </>
            ) : (
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] italic">No result in this run</p>
            )}
          </div>
        </div>

        {/* Run B */}
        <div className="bg-white dark:bg-[#0f1011]">
          <div className="px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wider font-medium">Run B</p>
              <p className="text-[12px] text-[#0a0a0a] dark:text-[#f7f8f8] mt-0.5">
                {runBName || data.runB?.name || `Run ${runBId.slice(0, 8)}`}
              </p>
            </div>
            {data.resultB && (
              <div className="flex items-center gap-2">
                {data.resultB.humanRating && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ratingBadge[data.resultB.humanRating] || ""}`}>
                    {data.resultB.humanRating}
                  </span>
                )}
                {data.resultB.judgeScore !== null && (
                  <span className="text-[10px] text-[#8a8f98] dark:text-[#62666d]">{data.resultB.judgeScore}/100</span>
                )}
              </div>
            )}
          </div>
          <div className="p-4 min-h-[120px]">
            {data.resultB ? (
              <>
                {data.resultB.status === "error" ? (
                  <p className="text-[12px] text-red-500">{data.resultB.errorMessage || "Error"}</p>
                ) : (
                  <p className="text-[12px] text-[#d0d6e0] leading-relaxed whitespace-pre-wrap">
                    {highlightDiff(data.diff, "added")}
                  </p>
                )}
                {data.resultB.responseTime && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[#8a8f98] dark:text-[#62666d]">
                    <Clock className="h-3 w-3" /> {data.resultB.responseTime}ms
                  </div>
                )}
              </>
            ) : (
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] italic">No result in this run</p>
            )}
          </div>
        </div>
      </div>

      {/* Inline diff view */}
      <div className="card p-4">
        <p className="text-[12px] font-medium text-[#8a8f98] dark:text-[#62666d] mb-2" style={{ letterSpacing: "-0.01em" }}>
          Inline Diff
        </p>
        <div className="text-[12px] leading-relaxed whitespace-pre-wrap bg-black/[0.02] dark:bg-white/[0.02] rounded-lg p-3">
          {renderInlineDiff(data.diff)}
        </div>
      </div>
    </div>
  );
}

function highlightDiff(segments: DiffSegment[], side: "removed" | "added"): React.ReactNode {
  return segments.map((seg, i) => {
    if (seg.type === "same" || seg.type === side) {
      return <span key={i}>{seg.value}</span>;
    }
    return null;
  });
}

function renderInlineDiff(segments: DiffSegment[]): React.ReactNode {
  return segments.map((seg, i) => {
    if (seg.type === "same") {
      return <span key={i} className="text-[#d0d6e0]">{seg.value}</span>;
    }
    if (seg.type === "removed") {
      return (
        <span key={i} className="bg-red-500/15 text-red-400 line-through rounded px-0.5">
          {seg.value}
        </span>
      );
    }
    return (
      <span key={i} className="bg-emerald-500/15 text-emerald-400 rounded px-0.5">
        {seg.value}
      </span>
    );
  });
}
