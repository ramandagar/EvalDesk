"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  Filter,
  ShieldCheck,
} from "lucide-react";

interface TestCase {
  id: string;
  title: string;
  input: string;
  expectedOutput: string | null;
  category: string | null;
  difficulty: string | null;
  source: string | null;
  goldenSet: boolean;
}

interface ValidationIssue {
  testCaseId: string;
  title: string;
  issue: string;
  severity: "error" | "warning";
}

interface ValidationResult {
  valid: boolean;
  totalGolden: number;
  issues: ValidationIssue[];
  summary: string;
}

interface GoldenSetManagerProps {
  projectId: string;
}

export function GoldenSetManager({ projectId }: GoldenSetManagerProps) {
  const [allCases, setAllCases] = useState<TestCase[]>([]);
  const [goldenIds, setGoldenIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterGolden, setFilterGolden] = useState<"all" | "golden" | "non-golden">("all");

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/test-cases?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to load cases");
      const data = await res.json();
      const cases: TestCase[] = Array.isArray(data) ? data : data.cases || [];
      setAllCases(cases);
      setGoldenIds(new Set(cases.filter((c) => c.goldenSet).map((c) => c.id)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const toggleGolden = async (caseId: string) => {
    const isGolden = goldenIds.has(caseId);
    const action = isGolden ? "unmark" : "mark";
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/test-cases/golden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action, caseIds: [caseId] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      const next = new Set(goldenIds);
      if (isGolden) next.delete(caseId);
      else next.add(caseId);
      setGoldenIds(next);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/test-cases/golden?projectId=${projectId}&action=export`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `golden-set-${projectId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidate = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/test-cases/golden?projectId=${projectId}&action=validate`);
      if (!res.ok) throw new Error("Validation failed");
      const data = await res.json();
      setValidation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter and search
  const filteredCases = allCases.filter((c) => {
    if (filterGolden === "golden" && !goldenIds.has(c.id)) return false;
    if (filterGolden === "non-golden" && goldenIds.has(c.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.input.toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const goldenCount = goldenIds.size;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">
            Golden Set Manager
          </h2>
          <p className="text-sm text-[#8a8f98] dark:text-[#62666d] mt-1">
            {goldenCount} verified reference case{goldenCount !== 1 ? "s" : ""} in golden set
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleValidate}
            disabled={actionLoading || goldenCount === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] px-3 py-1.5 text-xs font-medium text-[#0a0a0a] dark:text-[#f7f8f8] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2d32] transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Validate
          </button>
          <button
            onClick={handleExport}
            disabled={actionLoading || goldenCount === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#ABC83A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#9ab832] transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Validation Result */}
      {validation && (
        <div
          className={`rounded-lg border p-3 ${
            validation.valid
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-amber-500/20 bg-amber-500/5"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {validation.valid ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">
              {validation.summary}
            </span>
          </div>
          {validation.issues.length > 0 && (
            <div className="space-y-1 ml-6">
              {validation.issues.map((issue, i) => (
                <p
                  key={i}
                  className={`text-xs ${
                    issue.severity === "error" ? "text-red-500" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  [{issue.severity}] {issue.title}: {issue.issue}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f98]" />
          <input
            type="text"
            placeholder="Search test cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] bg-white dark:bg-[#1a1c1e] pl-9 pr-3 py-2 text-sm text-[#0a0a0a] dark:text-[#f7f8f8] placeholder:text-[#8a8f98] outline-none focus:border-[#ABC83A]"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] p-0.5">
          {(["all", "golden", "non-golden"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterGolden(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filterGolden === f
                  ? "bg-[#ABC83A]/10 text-[#ABC83A]"
                  : "text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
              }`}
            >
              {f === "all" ? "All" : f === "golden" ? "Golden" : "Not Golden"}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Case List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[#8a8f98] dark:text-[#62666d]">
            {allCases.length === 0
              ? "No test cases yet. Generate or create some first."
              : "No cases match your filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredCases.map((tc) => {
            const isGolden = goldenIds.has(tc.id);
            return (
              <div
                key={tc.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isGolden
                    ? "border-[#ABC83A]/30 bg-[#ABC83A]/5"
                    : "border-[#e5e7eb] dark:border-[#2a2d32]"
                }`}
              >
                <button
                  onClick={() => toggleGolden(tc.id)}
                  disabled={actionLoading}
                  className="mt-0.5 shrink-0"
                  title={isGolden ? "Remove from golden set" : "Add to golden set"}
                >
                  <Star
                    className={`h-4 w-4 transition-colors ${
                      isGolden
                        ? "fill-[#ABC83A] text-[#ABC83A]"
                        : "text-[#8a8f98] hover:text-[#ABC83A]"
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#0a0a0a] dark:text-[#f7f8f8] truncate">
                      {tc.title}
                    </p>
                    {tc.difficulty && (
                      <span className="shrink-0 text-xs text-[#8a8f98] dark:text-[#62666d]">
                        {tc.difficulty}
                      </span>
                    )}
                    {tc.category && (
                      <span className="shrink-0 rounded-md bg-[#6D75A6]/10 px-1.5 py-0.5 text-xs text-[#6D75A6]">
                        {tc.category}
                      </span>
                    )}
                    {tc.source && (
                      <span className="shrink-0 rounded-md bg-[#6FA3A5]/10 px-1.5 py-0.5 text-xs text-[#6FA3A5]">
                        {tc.source}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8a8f98] dark:text-[#62666d] line-clamp-2">
                    {tc.input}
                  </p>
                  {tc.expectedOutput && (
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 line-clamp-1 mt-1">
                      Expected: {tc.expectedOutput.slice(0, 100)}
                      {tc.expectedOutput.length > 100 ? "..." : ""}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
