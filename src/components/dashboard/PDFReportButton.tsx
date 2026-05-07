"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PDFReportButtonProps {
  runId: string;
  runName?: string | null;
  size?: "sm" | "md";
}

export function PDFReportButton({ runId, runName, size = "md" }: PDFReportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function downloadPDF() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/pdf?runId=${runId}`);
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to generate report");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : `${runName || "report"}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch {
      toast.error("Failed to generate report");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={downloadPDF}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-150 border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-[#0f1011] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#0a0a0a] dark:text-[#f7f8f8] ${
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"
      }`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
      {loading ? "Generating..." : "PDF Report"}
    </button>
  );
}
