"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { CommentThread } from "@/components/dashboard/CommentThread";
import { AnnotationQueue } from "@/components/dashboard/AnnotationQueue";
import { ApiKeyManager } from "@/components/dashboard/ApiKeyManager";
import { AuditLogTable } from "@/components/dashboard/AuditLogTable";
import { RoleSelector } from "@/components/dashboard/RoleSelector";
import { Users, MessageSquare, Key, ClipboardList, ShieldCheck } from "lucide-react";

export default function CollaborationPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState<"team" | "comments" | "annotations" | "apikeys" | "audit">("team");

  const tabs = [
    { id: "team" as const, label: "Team Roles", icon: Users },
    { id: "comments" as const, label: "Comments", icon: MessageSquare },
    { id: "annotations" as const, label: "Annotation Queue", icon: ClipboardList },
    { id: "apikeys" as const, label: "API Keys", icon: Key },
    { id: "audit" as const, label: "Audit Log", icon: ShieldCheck },
  ];

  return (
    <div>
      <DashboardHeader title="Collaboration" subtitle="Team management and access control" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-1 w-fit flex-wrap">
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

        {activeTab === "team" && <RoleSelector projectId={projectId} />}
        {activeTab === "comments" && <CommentThread projectId={projectId} />}
        {activeTab === "annotations" && <AnnotationQueue projectId={projectId} />}
        {activeTab === "apikeys" && <ApiKeyManager projectId={projectId} />}
        {activeTab === "audit" && <AuditLogTable projectId={projectId} />}
      </div>
    </div>
  );
}
