"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { ExecutiveSummary } from "@/components/dashboard/ExecutiveSummary";

export default function ExecutivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/executive")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center surface-base">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ABC83A] border-t-transparent" />
    </div>
  );

  return (
    <div>
      <DashboardHeader title="Executive Overview" subtitle="Cross-project performance and cost analytics" />
      <div className="p-5">
        <ExecutiveSummary data={data} />
      </div>
    </div>
  );
}
