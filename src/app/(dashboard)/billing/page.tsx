"use client";

import { useState, useEffect } from "react";
import { CreditCard, Check, Loader2, Zap, Building2, ArrowRight, Info } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string | null;
  limits: string | null;
}

interface Subscription {
  id: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

const PLAN_CONFIG = [
  {
    name: "Free",
    price: 0,
    description: "Get started with basic evaluation",
    icon: Zap,
    features: ["5 projects", "100 test cases", "1 team member", "Basic LLM judge"],
    color: "#8a8f98",
    stripePriceId: "price_free",
  },
  {
    name: "Pro",
    price: 29,
    description: "For teams building production AI",
    icon: CreditCard,
    features: ["Unlimited projects", "Unlimited test cases", "10 team members", "Multi-judge consensus", "Safety scoring", "Priority support"],
    color: "#ABC83A",
    stripePriceId: "price_pro_monthly",
  },
  {
    name: "Enterprise",
    price: 99,
    description: "For organizations with advanced needs",
    icon: Building2,
    features: ["Unlimited everything", "Custom judge templates", "SSO & audit logs", "Dedicated support", "SLA guarantee", "Custom integrations"],
    color: "#0a0a0a",
    stripePriceId: "price_enterprise_monthly",
  },
];

export default function BillingPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [testCases, setTestCases] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const subRes = await fetch("/api/billing/subscription");
      if (subRes.ok) {
        const data = await subRes.json();
        setPlan(data.plan);
        setSubscription(data.subscription);
      }
      const projRes = await fetch("/api/projects");
      if (projRes.ok) {
        const projs = await projRes.json();
        setProjects(projs);
        let tc = 0;
        for (const p of projs) tc += p.testCaseCount || 0;
        setTestCases(tc);
      }
    } catch {}
    setLoading(false);
  }

  async function handleUpgrade(planConfig: typeof PLAN_CONFIG[0]) {
    setUpgrading(planConfig.name);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: planConfig.stripePriceId }),
      });
      const data = await res.json();
      if (data.message === "Demo mode") {
        setIsDemo(true);
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {}
    setUpgrading(null);
  }

  async function handleManage() {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {}
  }

  const currentPlanName = plan?.name || "Free";

  function getLimit(key: string): number {
    if (!plan?.limits) return 5;
    try {
      const limits = JSON.parse(plan.limits);
      return limits[key] ?? -1;
    } catch {
      return -1;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-[#8a8f98]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="flex items-center gap-3 rounded-lg border border-[#ABC83A]/20 bg-[#ABC83A]/5 px-4 py-3">
          <Info size={16} className="text-[#ABC83A] shrink-0" />
          <p className="text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8]">
            Billing demo mode — connect Stripe to enable payments
          </p>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-[20px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
          Billing
        </h1>
        <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">
          Manage your subscription and view usage
        </p>
      </div>

      {/* Current plan */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wide">
              Current Plan
            </p>
            <p className="mt-1 text-[18px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
              {currentPlanName}
            </p>
            {subscription && (
              <p className="mt-0.5 text-[12px] text-[#8a8f98] dark:text-[#62666d]">
                Status: <span className="capitalize text-[#ABC83A]">{subscription.status}</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
              ${PLAN_CONFIG.find(p => p.name === currentPlanName)?.price || 0}
              <span className="text-[13px] font-normal text-[#8a8f98]">/mo</span>
            </p>
          </div>
        </div>
        {subscription?.stripeSubscriptionId && (
          <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
            <button onClick={handleManage} className="btn-secondary text-[13px]">
              Manage Subscription
            </button>
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-[12px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wide">Projects</p>
          <p className="mt-2 text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
            {projects.length}
            <span className="text-[13px] font-normal text-[#8a8f98]">
              / {getLimit("projects") === -1 ? "unlimited" : getLimit("projects")}
            </span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-[#ABC83A] transition-all"
              style={{ width: `${Math.min(100, getLimit("projects") === -1 ? 10 : (projects.length / getLimit("projects")) * 100)}%` }}
            />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-[12px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wide">Test Cases</p>
          <p className="mt-2 text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
            {testCases}
            <span className="text-[13px] font-normal text-[#8a8f98]">
              / {getLimit("testCases") === -1 ? "unlimited" : getLimit("testCases")}
            </span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-[#ABC83A] transition-all"
              style={{ width: `${Math.min(100, getLimit("testCases") === -1 ? 10 : (testCases / getLimit("testCases")) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Plan selection */}
      <div>
        <h2 className="text-[15px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-4" style={{ letterSpacing: "-0.02em" }}>
          Plans
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {PLAN_CONFIG.map((planOption) => {
            const isCurrent = currentPlanName === planOption.name;
            const Icon = planOption.icon;
            return (
              <div
                key={planOption.name}
                className={`card p-5 flex flex-col ${isCurrent ? "border-[#ABC83A] border-2" : ""}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${planOption.color}15` }}
                  >
                    <Icon size={16} style={{ color: planOption.color }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>
                      {planOption.name}
                    </p>
                  </div>
                </div>
                <p className="text-[24px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-1" style={{ letterSpacing: "-0.02em" }}>
                  ${planOption.price}
                  <span className="text-[12px] font-normal text-[#8a8f98]">/mo</span>
                </p>
                <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-4">
                  {planOption.description}
                </p>
                <ul className="space-y-1.5 flex-1 mb-4">
                  {planOption.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-[#0a0a0a] dark:text-[#d0d6e0]">
                      <Check size={12} className="text-[#ABC83A] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button disabled className="btn-secondary w-full text-[13px] opacity-60 cursor-default">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(planOption)}
                    disabled={upgrading === planOption.name}
                    className="btn-primary w-full text-[13px]"
                  >
                    {upgrading === planOption.name ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>Upgrade <ArrowRight size={12} /></>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice history */}
      <div>
        <h2 className="text-[15px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-4" style={{ letterSpacing: "-0.02em" }}>
          Invoice History
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-medium text-[#8a8f98] dark:text-[#62666d] uppercase tracking-wide">Invoice</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06] last:border-0">
                <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#8a8f98] dark:text-[#62666d]">
                  No invoices yet
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
