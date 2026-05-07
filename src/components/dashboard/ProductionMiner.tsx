"use client";

import { useState } from "react";
import {
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  ClipboardPaste,
  Settings2,
} from "lucide-react";

interface MiningResult {
  success: boolean;
  mined: number;
  totalLogs: number;
  skippedEmpty: number;
  skippedUnhelpful: number;
  cases: Array<{
    id: string;
    title: string;
    input: string;
    category: string;
    difficulty: string;
    source: string;
  }>;
}

interface ProductionMinerProps {
  projectId: string;
}

const SAMPLE_LOGS = `[
  {
    "userMessage": "How do I reset my password?",
    "agentResponse": "To reset your password, go to Settings > Security > Reset Password and follow the prompts.",
    "wasHelpful": true
  },
  {
    "userMessage": "Your product is terrible and I want a refund",
    "agentResponse": "I'm sorry to hear that. Let me help you with the refund process right away.",
    "wasHelpful": true
  },
  {
    "userMessage": "hi",
    "agentResponse": "Hello! How can I help you today?",
    "wasHelpful": null
  }
]`;

export function ProductionMiner({ projectId }: ProductionMinerProps) {
  const [rawLogs, setRawLogs] = useState("");
  const [onlyHelpful, setOnlyHelpful] = useState(false);
  const [minInputLength, setMinInputLength] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MiningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawLogs(text);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setRawLogs(SAMPLE_LOGS);
    setResult(null);
    setError(null);
  };

  const handleClear = () => {
    setRawLogs("");
    setResult(null);
    setError(null);
  };

  const handleMine = async () => {
    if (!rawLogs.trim()) {
      setError("Please paste or upload production conversation logs.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/test-cases/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          rawLogs,
          options: {
            onlyHelpful,
            minInputLength,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Mining failed");
        return;
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  // Quick stats
  let logCount = 0;
  try {
    if (rawLogs.trim()) logCount = JSON.parse(rawLogs).length;
  } catch {
    // Not valid JSON yet, that's okay
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">
          Production Log Miner
        </h2>
        <p className="text-sm text-[#8a8f98] dark:text-[#62666d] mt-1">
          Convert production conversation logs into test cases automatically.
        </p>
      </div>

      {/* Input Area */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">
            Conversation Logs (JSON)
          </label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] px-2.5 py-1 text-xs font-medium text-[#0a0a0a] dark:text-[#f7f8f8] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2d32] transition-colors cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              Upload File
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={handleLoadSample}
              className="text-xs text-[#ABC83A] hover:underline"
            >
              Load sample
            </button>
            {rawLogs && (
              <button
                onClick={handleClear}
                className="text-xs text-[#8a8f98] hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <textarea
            value={rawLogs}
            onChange={(e) => setRawLogs(e.target.value)}
            placeholder={`Paste JSON array of conversation logs, e.g.:\n[\n  {\n    "userMessage": "How do I reset my password?",\n    "agentResponse": "Go to Settings > Security...",\n    "wasHelpful": true\n  }\n]`}
            rows={8}
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] bg-white dark:bg-[#1a1c1e] px-3 py-2 text-sm text-[#0a0a0a] dark:text-[#f7f8f8] placeholder:text-[#8a8f98] outline-none focus:border-[#ABC83A] font-mono text-xs resize-y"
          />
          {logCount > 0 && (
            <span className="absolute bottom-2 right-2 text-xs text-[#8a8f98] bg-white dark:bg-[#1a1c1e] px-1.5 py-0.5 rounded">
              {logCount} log{logCount !== 1 ? "s" : ""} detected
            </span>
          )}
        </div>
        <p className="text-xs text-[#8a8f98] dark:text-[#62666d] mt-1">
          Format: JSON array of {`{ userMessage, agentResponse, wasHelpful }`}
        </p>
      </div>

      {/* Options */}
      <div>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center gap-1.5 text-sm text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Mining Options
        </button>
        {showOptions && (
          <div className="mt-2 rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] p-3 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyHelpful}
                onChange={(e) => setOnlyHelpful(e.target.checked)}
                className="rounded border-[#e5e7eb] dark:border-[#2a2d32] accent-[#ABC83A]"
              />
              <span className="text-sm text-[#0a0a0a] dark:text-[#f7f8f8]">
                Only include helpful responses
              </span>
            </label>
            <div className="flex items-center gap-3">
              <label className="text-sm text-[#8a8f98] dark:text-[#62666d] shrink-0">
                Min input length
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={minInputLength}
                onChange={(e) => setMinInputLength(parseInt(e.target.value) || 5)}
                className="w-20 rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] bg-white dark:bg-[#1a1c1e] px-2 py-1 text-sm text-[#0a0a0a] dark:text-[#f7f8f8] outline-none focus:border-[#ABC83A]"
              />
              <span className="text-xs text-[#8a8f98] dark:text-[#62666d]">characters</span>
            </div>
          </div>
        )}
      </div>

      {/* Mine Button */}
      <button
        onClick={handleMine}
        disabled={loading || !rawLogs.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ABC83A] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#9ab832] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mining Logs...
          </>
        ) : (
          <>
            <FileJson className="h-4 w-4" />
            Mine Test Cases
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-[#0a0a0a] dark:text-[#f7f8f8] font-medium">
              Mined {result.mined} test cases from {result.totalLogs} logs
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] p-2.5 text-center">
              <p className="text-lg font-semibold text-emerald-500">{result.mined}</p>
              <p className="text-xs text-[#8a8f98] dark:text-[#62666d]">Mined</p>
            </div>
            <div className="rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] p-2.5 text-center">
              <p className="text-lg font-semibold text-amber-500">{result.skippedEmpty}</p>
              <p className="text-xs text-[#8a8f98] dark:text-[#62666d]">Skipped (empty)</p>
            </div>
            <div className="rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] p-2.5 text-center">
              <p className="text-lg font-semibold text-zinc-500">{result.skippedUnhelpful}</p>
              <p className="text-xs text-[#8a8f98] dark:text-[#62666d]">Skipped (unhelpful)</p>
            </div>
          </div>

          {/* Preview */}
          {result.cases.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {result.cases.slice(0, 8).map((c, i) => (
                <div
                  key={c.id || i}
                  className="rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] p-2.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">
                      {c.title}
                    </span>
                    <span className="shrink-0 text-xs text-[#8a8f98]">{c.difficulty}</span>
                    <span className="shrink-0 rounded-md bg-[#6FA3A5]/10 px-1.5 py-0.5 text-xs text-[#6FA3A5]">
                      {c.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#8a8f98] dark:text-[#62666d] line-clamp-1">
                    {c.input}
                  </p>
                </div>
              ))}
              {result.cases.length > 8 && (
                <p className="text-xs text-[#8a8f98] dark:text-[#62666d] text-center py-1">
                  + {result.cases.length - 8} more cases
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
