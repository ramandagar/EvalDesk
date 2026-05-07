"use client";

import { useEffect, useState } from "react";
import { Layers, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface SampleError {
  testCaseId: string;
  testCaseTitle: string | null;
  errorSnippet: string;
}

interface Cluster {
  label: string;
  size: number;
  sampleErrors: SampleError[];
  testCaseIds: string[];
}

interface Props {
  projectId?: string;
}

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8] capitalize">
            {cluster.label}
          </p>
          <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
            {cluster.size} failure{cluster.size !== 1 ? "s" : ""} across {cluster.testCaseIds.length} test case{cluster.testCaseIds.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 text-[11px] font-medium text-red-500">
            {cluster.size}
          </span>
          <button onClick={() => setExpanded(!expanded)} className="text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {expanded && cluster.sampleErrors.length > 0 && (
        <div className="mt-3 space-y-2 pl-3 border-l-2 border-red-500/20">
          {cluster.sampleErrors.map((err, i) => (
            <div key={i} className="text-[11px]">
              <p className="font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">
                {err.testCaseTitle || `Test ${err.testCaseId.slice(0, 8)}`}
              </p>
              <p className="text-[#8a8f98] dark:text-[#62666d] line-clamp-2 mt-0.5">{err.errorSnippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FailureClusters({ projectId }: Props) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const params = projectId ? `?projectId=${projectId}` : "";
      const res = await fetch(`/api/analytics/clusters${params}`);
      if (res.ok) { const json = await res.json(); setClusters(json.clusters || []); }
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#ABC83A]" />
        <span className="ml-2 text-[13px] text-[#8a8f98]">Clustering failures...</span>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Layers className="mx-auto h-6 w-6 text-[#8a8f98]" />
        <p className="mt-2 text-[13px] text-[#8a8f98]">No failure clusters found. Need failing results to cluster.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Failure Clusters</h3>
        <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">{clusters.length} cluster{clusters.length !== 1 ? "s" : ""} of similar failures detected</p>
      </div>
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
        {clusters.map((cluster, i) => <ClusterCard key={i} cluster={cluster} />)}
      </div>
    </div>
  );
}
