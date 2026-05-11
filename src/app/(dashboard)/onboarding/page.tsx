"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Code2, Briefcase, GraduationCap, User,
  Heart, Scale, DollarSign, BookOpen, Headphones, HelpCircle,
  ArrowRight, ArrowLeft, Loader2, FolderKanban, Rocket
} from "lucide-react";

const ROLES = [
  { id: "engineer", label: "Engineer", icon: Code2, description: "Building and testing AI agents" },
  { id: "pm", label: "Product Manager", icon: Briefcase, description: "Evaluating AI product quality" },
  { id: "domain_expert", label: "Domain Expert", icon: GraduationCap, description: "Validating AI in your field" },
  { id: "other", label: "Other", icon: User, description: "Exploring AI evaluation" },
];

const USE_CASES = [
  { id: "healthcare", label: "Healthcare AI", icon: Heart },
  { id: "legal", label: "Legal AI", icon: Scale },
  { id: "financial", label: "Financial AI", icon: DollarSign },
  { id: "education", label: "Education AI", icon: BookOpen },
  { id: "support", label: "Customer Support", icon: Headphones },
  { id: "other", label: "Other", icon: HelpCircle },
];

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [useCase, setUseCase] = useState("");
  const [projectName, setProjectName] = useState("");
  const [agentUrl, setAgentUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    try {
      const res = await fetch("/api/onboarding");
      if (res.ok) {
        const data = await res.json();
        if (data.isComplete) {
          router.push("/dashboard");
          return;
        }
        if (data.role) setRole(data.role);
        if (data.useCase) setUseCase(data.useCase);
        if (data.currentStep) setStep(data.currentStep);
      }
    } catch {}
  }

  async function saveStep(data: Record<string, any>) {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {}
  }

  async function handleNext() {
    if (step === 1) {
      await saveStep({ currentStep: 2, role });
      setStep(2);
    } else if (step === 2) {
      await saveStep({ currentStep: 3, role, useCase });
      setStep(3);
    }
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  async function handleFinish() {
    if (!projectName.trim()) return;
    setLoading(true);
    try {
      // Create project
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          endpoint: agentUrl || undefined,
        }),
      });

      // Mark onboarding complete
      await saveStep({ currentStep: 3, role, useCase, isComplete: true });

      router.push("/projects");
    } catch {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await saveStep({ currentStep: step, role, useCase, isComplete: true });
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#09090b]">
      <div className="w-full max-w-lg px-5">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ABC83A]">
            <span className="text-[16px] font-bold text-[#09090b]">E</span>
          </div>
          <h1 className="text-[17px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
            Welcome to EvalDesk
          </h1>
          <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">
            Let&apos;s get you set up in a few steps
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#8a8f98] dark:text-[#62666d]">
              Step {step} of {TOTAL_STEPS}
            </span>
            <button
              onClick={handleSkip}
              className="text-[11px] text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] transition-colors"
            >
              Skip for now
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-[#ABC83A] transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="card p-6">
          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div>
              <h2 className="text-[15px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-1" style={{ letterSpacing: "-0.02em" }}>
                What best describes your role?
              </h2>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-4">
                This helps us customize your experience
              </p>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const selected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all duration-150 ${
                        selected
                          ? "border-[#ABC83A] bg-[#ABC83A]/5"
                          : "border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12]"
                      }`}
                    >
                      <Icon size={18} className={selected ? "text-[#ABC83A]" : "text-[#8a8f98]"} />
                      <p className={`text-[13px] font-medium ${selected ? "text-[#0a0a0a] dark:text-[#f7f8f8]" : "text-[#0a0a0a] dark:text-[#d0d6e0]"}`} style={{ letterSpacing: "-0.01em" }}>
                        {r.label}
                      </p>
                      <p className="text-[11px] text-[#8a8f98] dark:text-[#62666d]">{r.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Use Case */}
          {step === 2 && (
            <div>
              <h2 className="text-[15px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-1" style={{ letterSpacing: "-0.02em" }}>
                What are you evaluating?
              </h2>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-4">
                We&apos;ll suggest relevant test templates
              </p>
              <div className="grid grid-cols-2 gap-3">
                {USE_CASES.map((uc) => {
                  const Icon = uc.icon;
                  const selected = useCase === uc.id;
                  return (
                    <button
                      key={uc.id}
                      onClick={() => setUseCase(uc.id)}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all duration-150 ${
                        selected
                          ? "border-[#ABC83A] bg-[#ABC83A]/5"
                          : "border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12]"
                      }`}
                    >
                      <Icon size={18} className={selected ? "text-[#ABC83A]" : "text-[#8a8f98]"} />
                      <p className={`text-[13px] font-medium ${selected ? "text-[#0a0a0a] dark:text-[#f7f8f8]" : "text-[#0a0a0a] dark:text-[#d0d6e0]"}`} style={{ letterSpacing: "-0.01em" }}>
                        {uc.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: First Project */}
          {step === 3 && (
            <div>
              <h2 className="text-[15px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-1" style={{ letterSpacing: "-0.02em" }}>
                Create your first project
              </h2>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-4">
                You can add your agent endpoint later
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                    Project name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Healthcare Chatbot"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>
                    Agent URL <span className="text-[#8a8f98]">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={agentUrl}
                    onChange={(e) => setAgentUrl(e.target.value)}
                    placeholder="https://your-agent-api.com/chat"
                    className="input"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
            {step > 1 ? (
              <button onClick={handleBack} className="btn-secondary text-[13px]">
                <ArrowLeft size={14} /> Back
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                disabled={(step === 1 && !role) || (step === 2 && !useCase)}
                className="btn-primary text-[13px]"
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading || !projectName.trim()}
                className="btn-primary text-[13px]"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Rocket size={14} /> Start testing
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
