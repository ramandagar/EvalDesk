"use client";
import { useState, useEffect } from "react";

interface Template {
  id: string;
  domain: string;
  name: string;
  description: string;
  criteria: string;
  passThreshold: number;
}

interface Props {
  onSelect: (template: Template) => void;
  selectedId?: string;
}

export function JudgeTemplatePicker({ onSelect, selectedId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/judge/templates").then(r => r.json()).then(data => {
      setTemplates(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-[11px] text-[#8a8f98]">Loading templates...</div>;

  const domains = [...new Set(templates.map(t => t.domain))];

  return (
    <div className="space-y-2">
      {domains.map(domain => (
        <div key={domain}>
          <div className="text-[10px] font-medium text-[#62666d] uppercase tracking-wider mb-1">{domain}</div>
          {templates.filter(t => t.domain === domain).map(t => (
            <button key={t.id} onClick={() => onSelect(t)}
              className={`w-full text-left p-2 rounded-lg border text-[12px] mb-1 transition-colors ${
                selectedId === t.id
                  ? "border-[#ABC83A] bg-[#ABC83A]/10"
                  : "border-black/[0.06] dark:border-white/[0.08] hover:border-[#ABC83A]/50"
              }`}>
              <div className="font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{t.name}</div>
              <div className="text-[10px] text-[#8a8f98] mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
