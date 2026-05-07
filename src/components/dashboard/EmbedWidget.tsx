"use client";

import { useState } from "react";
import { Code, Image, Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface EmbedWidgetProps {
  projectId: string;
  projectName?: string;
}

type EmbedTab = "badge" | "html" | "markdown" | "json";

const badgeBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://evaldesk.app";

export function EmbedWidget({ projectId, projectName }: EmbedWidgetProps) {
  const [activeTab, setActiveTab] = useState<EmbedTab>("badge");
  const [copied, setCopied] = useState(false);

  const badgeUrl = `${badgeBaseUrl}/api/embed/badge?projectId=${projectId}`;
  const dataUrl = `${badgeBaseUrl}/api/embed/data?projectId=${projectId}`;
  const pageUrl = `${badgeBaseUrl}/embed/${projectId}`;

  const snippets: Record<EmbedTab, { label: string; icon: any; code: string }> = {
    badge: {
      label: "Badge URL",
      icon: Image,
      code: badgeUrl,
    },
    html: {
      label: "HTML",
      icon: Code,
      code: `<a href="${pageUrl}">\n  <img src="${badgeUrl}" alt="${projectName || "EvalDesk"} evaluation badge" />\n</a>`,
    },
    markdown: {
      label: "Markdown",
      icon: Code,
      code: `[![${projectName || "EvalDesk"} evaluation](${badgeUrl})](${pageUrl})`,
    },
    json: {
      label: "JSON API",
      icon: Code,
      code: dataUrl,
    },
  };

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  const current = snippets[activeTab];

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
              Embed Widget
            </h3>
            <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mt-0.5">
              Add live evaluation status to your README or docs
            </p>
          </div>
          {/* Badge preview */}
          <div className="flex-shrink-0">
            <img
              src={`/api/embed/badge?projectId=${projectId}`}
              alt="Eval badge"
              className="h-5"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-black/[0.06] dark:border-white/[0.06]">
        {(Object.entries(snippets) as [EmbedTab, typeof snippets[EmbedTab]][]).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 px-3 py-2 text-[12px] font-medium transition-all duration-150 ${
              activeTab === key
                ? "text-[#ABC83A] border-b-2 border-[#ABC83A] bg-[#ABC83A]/5"
                : "text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* Code snippet */}
      <div className="p-4">
        <div className="relative">
          <pre className="text-[12px] text-[#ABC83A] bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {current.code}
          </pre>
          <button
            onClick={() => copyToClipboard(current.code)}
            className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-150"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[#4E9363]" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[#8a8f98] dark:text-[#62666d]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
