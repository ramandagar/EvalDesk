"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { PDFReportButton } from "@/components/dashboard/PDFReportButton";
import { EmbedWidget } from "@/components/dashboard/EmbedWidget";
import { DiffViewer } from "@/components/dashboard/DiffViewer";
import { DomainScoreBreakdown } from "@/components/dashboard/DomainScoreBreakdown";
import {
  FileText,
  Code,
  ArrowLeftRight,
  BarChart3,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface RunOption {
  id: string;
  name: string | null;
  createdAt: string;
  passRate: number | null;
  totalCases: number;
  status: string;
}

interface TestCaseOption {
  id: string;
  title: string;
  category: string | null;
  input: string;
}

type ActiveTab = "pdf" | "embed" | "diff" | "scores";

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [runs, setRuns] = useState<RunOption[]>([]);
  const [testCases, setTestCases] = useState<TestCaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("pdf");

  // PDF tab
  const [selectedRunForPdf, setSelectedRunForPdf] = useState<string>("");

  // Diff tab
  const [diffRunA, setDiffRunA] = useState<string>("");
  const [diffRunB, setDiffRunB] = useState<string>("");
  const [diffTestCase, setDiffTestCase] = useState<string>("");
  const [showDiff, setShowDiff] = useState(false);

  // Scores tab
  const [selectedRunForScores, setSelectedRunForScores] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const [runsRes, tcRes] = await Promise.all([
        fetch(`/api/runs?projectId=${projectId}&limit=30`),
        fetch(`/api/test-cases?projectId=${projectId}`),
      ]);

      if (runsRes.ok) {
        const runsData: RunOption[] = await runsRes.json();
        setRuns(runsData);
        if (runsData.length > 0) {
          setSelectedRunForPdf(runsData[0].id);
          setSelectedRunForScores(runsData[0].id);
          if (runsData.length >= 2) {
            setDiffRunA(runsData[1].id);
            setDiffRunB(runsData[0].id);
          } else {
            setDiffRunA(runsData[0].id);
          }
        }
      }

      if (tcRes.ok) {
        const tcData: TestCaseOption[] = await tcRes.json();
        setTestCases(tcData);
        if (tcData.length > 0) {
          setDiffTestCase(tcData[0].id);
        }
      }
    } catch {}
    setLoading(false);
  }

  const tabs: { key: ActiveTab; label: string; icon: any }[] = [
    { key: "pdf", label: "PDF Report", icon: FileText },
    { key: "embed", label: "Embed Widget", icon: Code },
    { key: "diff", label: "Diff Viewer", icon: ArrowLeftRight },
    { key: "scores", label: "Domain Scores", icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="surface-base">
        <DashboardHeader title="Reports" subtitle="Generate reports and embed widgets" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#ABC83A]" />
          <span className="ml-2 text-[14px] text-[#8a8f98] dark:text-[#62666d]">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-base">
      <DashboardHeader title="Reports" subtitle="Generate reports, embed badges, and compare results" />
      <div className="p-5 space-y-5">
        {/* Tab bar */}
        <div className="card p-1.5 flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 flex-1 justify-center ${
                  activeTab === tab.key
                    ? "bg-[#ABC83A]/10 text-[#ABC83A]"
                    : "text-[#8a8f98] dark:text-[#62666d] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* PDF Report Tab */}
        {activeTab === "pdf" && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
                    Generate PDF Report
                  </h3>
                  <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-1">
                    Download a full evaluation report with detailed results, domain breakdown, and analytics.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-end gap-3">
                <div className="flex-1 max-w-xs">
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Select Run</label>
                  <select
                    value={selectedRunForPdf}
                    onChange={(e) => setSelectedRunForPdf(e.target.value)}
                    className="input"
                  >
                    <option value="">Choose a run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || `Run ${r.id.slice(0, 8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"} ({r.totalCases} cases)
                      </option>
                    ))}
                  </select>
                </div>
                {selectedRunForPdf && (
                  <PDFReportButton runId={selectedRunForPdf} runName={runs.find((r) => r.id === selectedRunForPdf)?.name} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Embed Tab */}
        {activeTab === "embed" && (
          <div className="space-y-4">
            <EmbedWidget projectId={projectId} projectName={runs[0] ? undefined : undefined} />
          </div>
        )}

        {/* Diff Tab */}
        {activeTab === "diff" && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-3" style={{ letterSpacing: "-0.02em" }}>
                Response Diff Viewer
              </h3>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-4">
                Compare the same test case across two different runs to see exactly what changed in your agent&apos;s responses.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Test Case</label>
                  <select
                    value={diffTestCase}
                    onChange={(e) => { setDiffTestCase(e.target.value); setShowDiff(false); }}
                    className="input"
                  >
                    <option value="">Select test case...</option>
                    {testCases.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.title || tc.input.slice(0, 60)} {tc.category ? `(${tc.category})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Run A (baseline)</label>
                  <select
                    value={diffRunA}
                    onChange={(e) => { setDiffRunA(e.target.value); setShowDiff(false); }}
                    className="input"
                  >
                    <option value="">Select run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || `Run ${r.id.slice(0, 8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Run B (new)</label>
                  <select
                    value={diffRunB}
                    onChange={(e) => { setDiffRunB(e.target.value); setShowDiff(false); }}
                    className="input"
                  >
                    <option value="">Select run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || `Run ${r.id.slice(0, 8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!diffTestCase || !diffRunA || !diffRunB) {
                      toast.error("Select a test case and two runs");
                      return;
                    }
                    if (diffRunA === diffRunB) {
                      toast.error("Select two different runs");
                      return;
                    }
                    setShowDiff(true);
                  }}
                  disabled={!diffTestCase || !diffRunA || !diffRunB}
                  className="btn-primary"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                  Compare
                </button>
              </div>
            </div>

            {showDiff && diffTestCase && diffRunA && diffRunB && (
              <DiffViewer
                testCaseId={diffTestCase}
                runAId={diffRunA}
                runBId={diffRunB}
                runAName={runs.find((r) => r.id === diffRunA)?.name}
                runBName={runs.find((r) => r.id === diffRunB)?.name}
              />
            )}

            {!showDiff && (
              <div className="card p-10 text-center">
                <ArrowLeftRight className="mx-auto h-8 w-8 text-[#8a8f98] dark:text-[#62666d]" />
                <p className="mt-3 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">Select runs to compare</p>
                <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">
                  Choose a test case and two runs above to see the diff.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Scores Tab */}
        {activeTab === "scores" && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-end gap-3">
                <div className="max-w-xs">
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1">Select Run</label>
                  <select
                    value={selectedRunForScores}
                    onChange={(e) => setSelectedRunForScores(e.target.value)}
                    className="input"
                  >
                    <option value="">Choose a run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || `Run ${r.id.slice(0, 8)}`} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {selectedRunForScores ? (
              <DomainScoreBreakdown runId={selectedRunForScores} />
            ) : (
              <div className="card p-10 text-center">
                <BarChart3 className="mx-auto h-8 w-8 text-[#8a8f98] dark:text-[#62666d]" />
                <p className="mt-3 text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">Select a run</p>
                <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">
                  Choose a run above to see the domain score breakdown.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
