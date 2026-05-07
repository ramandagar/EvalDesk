"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Zap,
  Lock,
  Database,
  Scale,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const ADVERSARIAL_TYPES = [
  {
    id: "jailbreak",
    label: "Jailbreak",
    description: "Bypass safety guardrails to produce harmful content",
    icon: ShieldAlert,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    id: "prompt_injection",
    label: "Prompt Injection",
    description: "Inject malicious instructions to override behavior",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    id: "data_leak",
    label: "Data Leak",
    description: "Extract training data, system prompts, or secrets",
    icon: Database,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    id: "bias_probe",
    label: "Bias Probe",
    description: "Test for discriminatory or stereotypical responses",
    icon: Scale,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
] as const;

type AdversarialTypeId = "jailbreak" | "prompt_injection" | "data_leak" | "bias_probe";

interface GeneratedCase {
  id: string;
  title: string;
  input: string;
  adversarialType: string;
  difficulty: string;
}

interface AdversarialGeneratorProps {
  projectId: string;
  apiKey?: string;
}

export function AdversarialGenerator({ projectId, apiKey }: AdversarialGeneratorProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<AdversarialTypeId>>(
    new Set(["jailbreak", "prompt_injection", "data_leak", "bias_probe"])
  );
  const [count, setCount] = useState(20);
  const [agentDescription, setAgentDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count: number;
    cases: GeneratedCase[];
    tokensUsed?: { input: number; output: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleType = (type: AdversarialTypeId) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedTypes(next);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/test-cases/adversarial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiKey,
          types: Array.from(selectedTypes),
          count,
          agentDescription: agentDescription || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]">
          Adversarial Test Generator
        </h2>
        <p className="text-sm text-[#8a8f98] dark:text-[#62666d] mt-1">
          Generate attack vectors to stress-test your agent&apos;s safety boundaries.
        </p>
      </div>

      {/* Type Selector */}
      <div>
        <label className="text-sm font-medium text-[#0a0a0a] dark:text-[#f7f8f8] mb-3 block">
          Attack Types
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ADVERSARIAL_TYPES.map((type) => {
            const isSelected = selectedTypes.has(type.id as AdversarialTypeId);
            return (
              <button
                key={type.id}
                onClick={() => toggleType(type.id as AdversarialTypeId)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? "border-[#ABC83A]/40 bg-[#ABC83A]/5 dark:bg-[#ABC83A]/10"
                    : "border-[#e5e7eb] dark:border-[#2a2d32] hover:border-[#ABC83A]/20"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${type.bg}`}
                >
                  <type.icon className={`h-4 w-4 ${type.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">
                    {type.label}
                  </p>
                  <p className="text-xs text-[#8a8f98] dark:text-[#62666d] mt-0.5">
                    {type.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-[#0a0a0a] dark:text-[#f7f8f8] mb-1.5 block">
            Number of Cases
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] bg-white dark:bg-[#1a1c1e] px-3 py-2 text-sm text-[#0a0a0a] dark:text-[#f7f8f8] outline-none focus:border-[#ABC83A]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#0a0a0a] dark:text-[#f7f8f8] mb-1.5 block">
            Agent Description <span className="text-[#8a8f98]">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Customer support chatbot for banking"
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] bg-white dark:bg-[#1a1c1e] px-3 py-2 text-sm text-[#0a0a0a] dark:text-[#f7f8f8] placeholder:text-[#8a8f98] outline-none focus:border-[#ABC83A]"
          />
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading || selectedTypes.size === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ABC83A] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#9ab832] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating Adversarial Cases...
          </>
        ) : (
          <>
            <ShieldAlert className="h-4 w-4" />
            Generate {count} Adversarial Cases
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-[#0a0a0a] dark:text-[#f7f8f8] font-medium">
              Generated {result.count} adversarial test cases
            </span>
            {result.tokensUsed && (
              <span className="text-[#8a8f98] dark:text-[#62666d]">
                ({result.tokensUsed.input + result.tokensUsed.output} tokens)
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {result.cases.slice(0, 10).map((c, i) => {
              const typeInfo = ADVERSARIAL_TYPES.find((t) => t.id === c.adversarialType);
              return (
                <div
                  key={c.id || i}
                  className="rounded-lg border border-[#e5e7eb] dark:border-[#2a2d32] p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        typeInfo ? `${typeInfo.bg} ${typeInfo.color}` : "bg-zinc-500/10 text-zinc-500"
                      }`}
                    >
                      {typeInfo?.label || c.adversarialType}
                    </span>
                    <span className="text-xs text-[#8a8f98] dark:text-[#62666d]">
                      {c.difficulty}
                    </span>
                  </div>
                  <p className="text-sm text-[#0a0a0a] dark:text-[#f7f8f8] line-clamp-2">
                    {c.input}
                  </p>
                </div>
              );
            })}
            {result.cases.length > 10 && (
              <p className="text-xs text-[#8a8f98] dark:text-[#62666d] text-center py-1">
                + {result.cases.length - 10} more cases
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
