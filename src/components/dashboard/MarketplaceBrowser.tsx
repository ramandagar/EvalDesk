"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store,
  Search,
  Download,
  Star,
  Users,
  Tag,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";

interface MarketplaceSuite {
  id: string;
  name: string;
  description: string;
  domain: string;
  totalCases: number;
  author: string;
  rating: number;
  downloads: number;
  tags: string[];
}

interface PreviewCase {
  input: string;
  category: string;
  difficulty: string;
}

interface PreviewSuite extends MarketplaceSuite {
  previewCases: PreviewCase[];
}

interface MarketplaceBrowserProps {
  projectId: string;
}

export function MarketplaceBrowser({ projectId }: MarketplaceBrowserProps) {
  const [suites, setSuites] = useState<MarketplaceSuite[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewSuite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<
    Map<string, { success: boolean; count: number; note?: string }>
  >(new Map());

  const fetchSuites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedDomain) params.set("domain", selectedDomain);

      const res = await fetch(`/api/test-cases/marketplace?${params}`);
      if (!res.ok) throw new Error("Failed to load marketplace");
      const data = await res.json();
      setSuites(data.suites || []);
      if (data.availableDomains) setDomains(data.availableDomains);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, selectedDomain]);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

  const handlePreview = async (suiteId: string) => {
    if (preview?.id === suiteId) {
      setPreview(null);
      return;
    }
    try {
      const res = await fetch(`/api/test-cases/marketplace?action=preview&suiteId=${suiteId}`);
      if (!res.ok) throw new Error("Failed to load preview");
      const data = await res.json();
      setPreview(data.suite);
    } catch {
      setError("Failed to load suite preview");
    }
  };

  const handleImport = async (suiteId: string) => {
    setImporting(suiteId);
    setError(null);
    try {
      const res = await fetch("/api/test-cases/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, suiteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }
      setImportResults((prev) => {
        const next = new Map(prev);
        next.set(suiteId, { success: true, count: data.imported, note: data.note });
        return next;
      });
    } catch (err: any) {
      setError(err.message);
      setImportResults((prev) => {
        const next = new Map(prev);
        next.set(suiteId, { success: false, count: 0 });
        return next;
      });
    } finally {
      setImporting(null);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${
          i < Math.floor(rating)
            ? "fill-[#ABC83A] text-[#ABC83A]"
            : i < rating
            ? "fill-[#ABC83A]/50 text-[#ABC83A]"
            : "text-[#8a8f98]"
        }`}
      />
    ));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">
          Test Suite Marketplace
        </h2>
        <p className="text-sm text-[#8a8f98] dark:text-[#62666d] mt-1">
          Browse and import community-curated test suites for your domain.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f98]" />
          <input
            type="text"
            placeholder="Search suites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] bg-white dark:bg-[#1a1c1e] pl-9 pr-3 py-2 text-sm text-[#0a0a0a] dark:text-[#f7f8f8] placeholder:text-[#8a8f98] outline-none focus:border-[#ABC83A]"
          />
        </div>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] bg-white dark:bg-[#1a1c1e] px-3 py-2 text-sm text-[#0a0a0a] dark:text-[#f7f8f8] outline-none focus:border-[#ABC83A]"
        >
          <option value="">All Domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Suites Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
        </div>
      ) : suites.length === 0 ? (
        <div className="text-center py-12">
          <Store className="h-8 w-8 text-[#8a8f98] mx-auto mb-3" />
          <p className="text-sm text-[#8a8f98] dark:text-[#62666d]">
            No suites found matching your search.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {suites.map((suite) => {
            const importResult = importResults.get(suite.id);
            const isImporting = importing === suite.id;
            const isPreviewed = preview?.id === suite.id;

            return (
              <div
                key={suite.id}
                className={`rounded-lg border transition-colors ${
                  isPreviewed
                    ? "border-[#ABC83A]/30 bg-[#ABC83A]/5"
                    : "border-[#e5e7eb] dark:border-[#2a2d32]"
                }`}
              >
                {/* Suite Card */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">
                          {suite.name}
                        </h3>
                        <span className="shrink-0 rounded-md bg-[#6FA3A5]/10 px-1.5 py-0.5 text-xs text-[#6FA3A5]">
                          {suite.domain}
                        </span>
                      </div>
                      <p className="text-xs text-[#8a8f98] dark:text-[#62666d] line-clamp-2 mb-2">
                        {suite.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-[#8a8f98] dark:text-[#62666d]">
                        <span className="flex items-center gap-1">
                          {renderStars(suite.rating)} {suite.rating}
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {suite.downloads.toLocaleString()}
                        </span>
                        <span>{suite.totalCases} cases</span>
                        <span className="text-[#62666d]">by {suite.author}</span>
                      </div>
                      {/* Tags */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {suite.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-md bg-[#6D75A6]/10 px-1.5 py-0.5 text-[10px] text-[#6D75A6]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {importResult?.success ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {importResult.count} imported
                        </div>
                      ) : (
                        <button
                          onClick={() => handleImport(suite.id)}
                          disabled={isImporting}
                          className="flex items-center gap-1.5 rounded-lg bg-[#ABC83A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#9ab832] transition-colors disabled:opacity-50"
                        >
                          {isImporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Import
                        </button>
                      )}
                      <button
                        onClick={() => handlePreview(suite.id)}
                        className="flex items-center gap-1 text-xs text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition-colors"
                      >
                        Preview
                        <ChevronRight
                          className={`h-3 w-3 transition-transform ${isPreviewed ? "rotate-90" : ""}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Panel */}
                {isPreviewed && preview && (
                  <div className="border-t border-[#e5e7eb] dark:border-[#2a2d32] p-4 bg-white/50 dark:bg-[#1a1c1e]/50">
                    <p className="text-xs font-medium text-[#0a0a0a] dark:text-[#f7f8f8] mb-2">
                      Sample Cases ({preview.previewCases.length} of {preview.totalCases})
                    </p>
                    <div className="space-y-2">
                      {preview.previewCases.map((pc, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-[#e5e7eb]/50 dark:border-[#2a2d32]/50 p-2.5"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="shrink-0 rounded-md bg-[#6D75A6]/10 px-1.5 py-0.5 text-[10px] text-[#6D75A6]">
                              {pc.category}
                            </span>
                            <span className="shrink-0 text-[10px] text-[#8a8f98]">
                              {pc.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-[#0a0a0a] dark:text-[#f7f8f8]">
                            &ldquo;{pc.input}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
