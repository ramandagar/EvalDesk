"use client";
import { useState } from "react";

interface ToolCall {
  id: string;
  toolName: string;
  arguments: string;
  result: string | null;
  expectedResult: string | null;
  isValid: number | null;
}

interface Props {
  runResultId: string;
}

export function ToolCallViewer({ runResultId }: Props) {
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<ToolCall[]>([]);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tool-calls?runResultId=${runResultId}`);
      const data = await res.json();
      setCalls(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const parseCalls = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tool-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runResultId }),
      });
      const data = await res.json();
      setCalls(data.parsed?.map((c: any, i: number) => ({
        id: `parsed-${i}`,
        toolName: c.name,
        arguments: JSON.stringify(c.arguments, null, 2),
        result: c.result || null,
        expectedResult: null,
        isValid: null,
      })) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={loadCalls} disabled={loading} className="btn-secondary text-[11px] px-2 py-1 disabled:opacity-50">
          Load
        </button>
        <button onClick={parseCalls} disabled={loading} className="btn-secondary text-[11px] px-2 py-1 disabled:opacity-50">
          Parse from response
        </button>
      </div>

      {calls.length > 0 && (
        <div className="space-y-1.5">
          {calls.map((c, i) => (
            <div key={c.id || i} className="p-2 rounded-lg border border-black/[0.06] dark:border-white/[0.08] text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{c.toolName}</span>
                {c.isValid !== null && (
                  <span className={c.isValid ? "text-[#4E9363]" : "text-red-500"}>
                    {c.isValid ? "Valid" : "Invalid"}
                  </span>
                )}
              </div>
              <pre className="mt-1 text-[10px] text-[#8a8f98] overflow-x-auto">{c.arguments}</pre>
              {c.result && <div className="mt-1 text-[10px] text-[#62666d]">Result: {c.result}</div>}
            </div>
          ))}
        </div>
      )}

      {calls.length === 0 && !loading && (
        <div className="text-[11px] text-[#62666d]">No tool calls detected</div>
      )}
    </div>
  );
}
