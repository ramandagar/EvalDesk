"use client";
import { useState } from "react";

interface CitationCheck {
  id: string;
  citationText: string;
  sourceUrl: string | null;
  isVerified: number | null;
  verificationStatus: string | null;
  notes: string | null;
}

interface Props {
  runResultId: string;
  apiKey?: string;
}

export function CitationCheckList({ runResultId, apiKey }: Props) {
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState<CitationCheck[]>([]);

  const runCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/judge/citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runResultId, apiKey }),
      });
      const data = await res.json();
      setCitations(data.citations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (s: string | null) => {
    if (s === "verified") return <span className="text-[#4E9363]">Verified</span>;
    if (s === "contradicted") return <span className="text-red-500">Contradicted</span>;
    return <span className="text-amber-500">Unverified</span>;
  };

  return (
    <div className="space-y-2">
      <button onClick={runCheck} disabled={loading}
        className="btn-secondary text-[12px] px-3 py-1.5 disabled:opacity-50">
        {loading ? "Checking..." : "Check Citations"}
      </button>

      {citations.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] text-[#8a8f98]">{citations.length} citation(s) found</div>
          {citations.map((c, i) => (
            <div key={i} className="p-2 rounded-lg border border-black/[0.06] dark:border-white/[0.08] text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#0a0a0a] dark:text-[#f7f8f8] truncate max-w-[70%]">{c.citationText.slice(0, 80)}...</span>
                {statusIcon(c.verificationStatus)}
              </div>
              {c.notes && <div className="text-[10px] text-[#62666d] mt-0.5">{c.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {citations.length === 0 && !loading && (
        <div className="text-[11px] text-[#8a8f98]">No citations found in response</div>
      )}
    </div>
  );
}
