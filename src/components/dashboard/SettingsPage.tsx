"use client";

import { useEffect, useState } from "react";
import { LogOut, Shield, Database, KeyRound } from "lucide-react";
import { getMe, logout, type Me } from "@/lib/client/api";
import { Page, PageHeader, Spinner, Card, Button } from "./kit";

export function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    getMe().then(setMe).catch(() => {});
  }, []);
  if (!me) return <Page><Spinner /></Page>;
  const org = me.orgs.find((o) => o.id === me.activeOrgId) ?? me.orgs[0];

  return (
    <Page>
      <PageHeader title="Settings" subtitle="Account, organization, and security." />
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Account</h3>
          <Row label="Email" value={me.user.email} />
          <Row label="User ID" value={me.user.id} mono />
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Organization</h3>
          <Row label="Name" value={org?.name ?? "—"} />
          <Row label="Slug" value={org?.slug ?? "—"} mono />
          <Row label="Your role" value={org?.role ?? "—"} />
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-1.5"><Shield size={14} /> Security &amp; data</h3>
          <Feature icon={<Database size={13} />} text="Your data stays in your database — self-hostable, data-residency safe." />
          <Feature icon={<KeyRound size={13} />} text="Agent API keys are envelope-encrypted (AES-256-GCM); never returned to the browser." />
          <Feature icon={<Shield size={13} />} text="Every record is org-scoped — cross-tenant access is structurally impossible." />
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold mb-3">Session</h3>
          <Button variant="danger" onClick={logout}><LogOut size={14} /> Sign out</Button>
        </Card>
      </div>
    </Page>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 text-[13px]">
      <span className="text-[#8a8f98]">{label}</span>
      <span className={`text-[#0a0a0a] dark:text-[#f7f8f8] ${mono ? "font-mono text-[12px]" : ""}`}>{value}</span>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 py-1 text-[12.5px] text-[#62666d] dark:text-[#8a8f98]">
      <span className="mt-0.5 text-[#5e7a00]">{icon}</span> {text}
    </div>
  );
}
