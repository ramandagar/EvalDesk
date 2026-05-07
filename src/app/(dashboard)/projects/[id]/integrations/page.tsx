"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { WebhookManager } from "@/components/dashboard/WebhookManager";
import { ScheduleEditor } from "@/components/dashboard/ScheduleEditor";
import { SlackConfig } from "@/components/dashboard/SlackConfig";
import { Link as LinkIcon, Webhook, Clock, Hash } from "lucide-react";

export default function IntegrationsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState<"webhooks" | "schedules" | "slack">("webhooks");

  const tabs = [
    { id: "webhooks" as const, label: "Webhooks", icon: Webhook },
    { id: "schedules" as const, label: "Scheduled Runs", icon: Clock },
    { id: "slack" as const, label: "Slack", icon: Hash },
  ];

  return (
    <div>
      <DashboardHeader title="Integrations" subtitle="Connect EvalDesk with your workflow" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white dark:bg-[#1a1a1a] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm"
                  : "text-[#8a8f98] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8]"
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "webhooks" && <WebhookManager projectId={projectId} />}
        {activeTab === "schedules" && <ScheduleEditor projectId={projectId} />}
        {activeTab === "slack" && <SlackConfig projectId={projectId} />}
      </div>
    </div>
  );
}
