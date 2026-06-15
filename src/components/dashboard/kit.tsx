"use client";

// Small shared UI primitives for the dashboard — consistent header, states,
// and surfaces so every page looks the same. Plain Tailwind + lucide icons.

import { Loader2 } from "lucide-react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0a0a0a] dark:text-[#f7f8f8]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-[#8a8f98] dark:text-[#62666d]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#8a8f98]">
      <Loader2 className="h-4 w-4 animate-spin" /> {label ?? "Loading…"}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08] py-14 text-center">
      <p className="text-[14px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-[#8a8f98]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2 text-[12px] text-red-500">{message}</div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-black/[0.06] dark:border-white/[0.06] surface-panel ${className}`}>{children}</div>;
}

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  running: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  completed: "bg-[#ABC83A]/15 text-[#5e7a00] border-[#ABC83A]/30",
  signed: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-neutral-500/10 text-neutral-500 border-neutral-500/20";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{status}</span>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-[#ABC83A] text-[#09090b] hover:brightness-105",
    ghost: "border border-black/[0.08] dark:border-white/[0.1] text-[#0a0a0a] dark:text-[#f7f8f8] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
    danger: "border border-red-500/30 text-red-600 hover:bg-red-500/5",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-[#8a8f98] dark:text-[#62666d]">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[#ABC83A]/60 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[#ABC83A]/60 resize-y ${props.className ?? ""}`}
    />
  );
}
