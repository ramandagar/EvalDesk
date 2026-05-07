"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { ModelComparisonTable } from "@/components/dashboard/ModelComparisonTable";
import { CostTracker } from "@/components/dashboard/CostTracker";

export default function ModelsPage() {
  const [modelData, setModelData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    Promise.all([
      fetch("/api/models/compare").then(r => r.json()),
      fetch(`/api/costs?period=${period}`).then(r => r.json()),
    ])
      .then(([m, c]) => {
        setModelData(m);
        setCostData(c);
      })
      .catch(() => {
        setModelData(null);
        setCostData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center surface-base">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" />
    </div>
  );

  return (
    <div>
      <DashboardHeader title="Model Comparison" subtitle="Compare performance and costs across AI models" />
      <div className="p-5 space-y-5">
        <ModelComparisonTable models={modelData?.models || []} />
        <CostTracker />
      </div>
    </div>
  );
}
