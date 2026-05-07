"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { RAGEvalPanel } from "@/components/dashboard/RAGEvalPanel";
import { PairwiseComparison } from "@/components/dashboard/PairwiseComparison";
import { RegressionGateBadge } from "@/components/dashboard/RegressionGateBadge";
import { ApprovalWorkflow } from "@/components/dashboard/ApprovalWorkflow";
import { FileSearch, ArrowLeftRight, Shield, CheckCircle, Loader2 } from "lucide-react";

type TabId = "rag" | "comparison" | "gate" | "approval";

interface Tab {
  id: TabId;
  label: string;
  icon: typeof FileSearch;
}

const tabs: Tab[] = [
  { id: "rag", label: "RAG Eval", icon: FileSearch },
  { id: "comparison", label: "Comparison", icon: ArrowLeftRight },
  { id: "gate", label: "Gate", icon: Shield },
  { id: "approval", label: "Approval", icon: CheckCircle },
];

interface RunResult {
  id: string;
  testCaseId: string;
  agentResponse: string;
  status: string;
  input?: string;
}

interface Run {
  id: string;
  name: string;
  status: string;
  passRate: number | null;
  approvalStatus: string | null;
  createdAt: string;
}

export default function EvalPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabId>("rag");
  const [runs, setRuns] = useState<Run[]>([]);
  const [results, setResults] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(true);

  // RAG state
  const [selectedResultId, setSelectedResultId] = useState("");
  const [ragContext, setRagContext] = useState("");
  const [ragResponse, setRagResponse] = useState("");
  const [ragExpectedAnswer, setRagExpectedAnswer] = useState("");

  // Comparison state
  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("");
  const [compareCriteria, setCompareCriteria] = useState("");

  // Gate state
  const [gateRunId, setGateRunId] = useState("");
  const [gateThreshold, setGateThreshold] = useState("80");

  // Approval state
  const [approvalRunId, setApprovalRunId] = useState("");

  useEffect(() => {
    loadRuns();
  }, [projectId]);

  async function loadRuns() {
    try {
      const res = await fetch(`/api/runs?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        const runList = Array.isArray(data) ? data : data.runs || [];
        setRuns(runList);
        if (runList.length > 0) {
          setGateRunId(runList[0].id);
          setApprovalRunId(runList[0].id);
          loadResults(runList[0].id);
        }
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  async function loadResults(runId: string) {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center surface-base">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader title="Advanced Evaluation" subtitle="RAG metrics, pairwise comparison, gating, and approvals" />
      <div className="p-5 space-y-5">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-black/[0.06] dark:border-white/[0.06]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 transition ${
                  isActive
                    ? "border-[#ABC83A] text-[#0a0a0a] dark:text-[#f7f8f8]"
                    : "border-transparent text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* RAG Eval Tab */}
        {activeTab === "rag" && (
          <div className="space-y-4">
            <div className="card p-4 space-y-3">
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
                RAG Evaluation
              </h3>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">
                Evaluate faithfulness, relevance, and context recall for RAG-powered responses.
              </p>

              {/* Result selector */}
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                  Select run result
                </label>
                <select
                  value={selectedResultId}
                  onChange={(e) => setSelectedResultId(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a result...</option>
                  {results.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id.slice(0, 8)} — {r.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Context input */}
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                  Context (retrieved documents)
                </label>
                <textarea
                  value={ragContext}
                  onChange={(e) => setRagContext(e.target.value)}
                  placeholder="Paste the context that was provided to the RAG system..."
                  rows={4}
                  className="input resize-none text-[12px]"
                />
              </div>

              {/* Response input */}
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                  Response (agent output)
                </label>
                <textarea
                  value={ragResponse}
                  onChange={(e) => setRagResponse(e.target.value)}
                  placeholder="Paste the agent's response..."
                  rows={4}
                  className="input resize-none text-[12px]"
                />
              </div>

              {/* Expected answer (optional) */}
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                  Expected answer (optional — needed for context recall)
                </label>
                <textarea
                  value={ragExpectedAnswer}
                  onChange={(e) => setRagExpectedAnswer(e.target.value)}
                  placeholder="Paste the expected answer..."
                  rows={3}
                  className="input resize-none text-[12px]"
                />
              </div>

              {selectedResultId && ragContext && ragResponse && (
                <RAGEvalPanel
                  runResultId={selectedResultId}
                  context={ragContext}
                  response={ragResponse}
                  expectedAnswer={ragExpectedAnswer || undefined}
                />
              )}
            </div>
          </div>
        )}

        {/* Comparison Tab */}
        {activeTab === "comparison" && (
          <div className="space-y-4">
            <div className="card p-4 space-y-3">
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
                Pairwise Comparison
              </h3>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">
                Compare two responses side-by-side using LLM judgment.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                    Response A
                  </label>
                  <select
                    value={compareAId}
                    onChange={(e) => setCompareAId(e.target.value)}
                    className="input"
                  >
                    <option value="">Choose result A...</option>
                    {results.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id.slice(0, 8)} — {r.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                    Response B
                  </label>
                  <select
                    value={compareBId}
                    onChange={(e) => setCompareBId(e.target.value)}
                    className="input"
                  >
                    <option value="">Choose result B...</option>
                    {results.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id.slice(0, 8)} — {r.status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                  Criteria (comma-separated, optional)
                </label>
                <input
                  value={compareCriteria}
                  onChange={(e) => setCompareCriteria(e.target.value)}
                  placeholder="accuracy, relevance, clarity"
                  className="input"
                />
              </div>

              {compareAId && compareBId && (
                <PairwiseComparison
                  resultAId={compareAId}
                  resultBId={compareBId}
                  criteria={
                    compareCriteria
                      ? compareCriteria.split(",").map((s) => s.trim()).filter(Boolean)
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Gate Tab */}
        {activeTab === "gate" && (
          <div className="space-y-4">
            <div className="card p-4 space-y-3">
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
                Regression Gate
              </h3>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">
                Check if runs meet the quality threshold before promotion.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                    Run
                  </label>
                  <select
                    value={gateRunId}
                    onChange={(e) => setGateRunId(e.target.value)}
                    className="input"
                  >
                    <option value="">Choose a run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || r.id.slice(0, 8)} — {r.passRate !== null ? `${r.passRate}%` : "N/A"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                    Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={gateThreshold}
                    onChange={(e) => setGateThreshold(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {gateRunId && (
                <RegressionGateBadge
                  runId={gateRunId}
                  threshold={parseInt(gateThreshold) || undefined}
                />
              )}
            </div>
          </div>
        )}

        {/* Approval Tab */}
        {activeTab === "approval" && (
          <div className="space-y-4">
            <div className="card p-4 space-y-3">
              <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
                Approval Workflow
              </h3>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">
                Approve or reject runs with audit trail.
              </p>

              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                  Run
                </label>
                <select
                  value={approvalRunId}
                  onChange={(e) => setApprovalRunId(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a run...</option>
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.id.slice(0, 8)} — {r.approvalStatus || "pending"}
                    </option>
                  ))}
                </select>
              </div>

              {approvalRunId && <ApprovalWorkflow runId={approvalRunId} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
