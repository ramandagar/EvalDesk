import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(): string {
  return nanoid(21);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return formatDate(date);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function passRateColor(rate: number): string {
  if (rate >= 80) return "text-emerald-500";
  if (rate >= 50) return "text-amber-500";
  return "text-red-500";
}

export function passRateBg(rate: number): string {
  if (rate >= 80) return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  if (rate >= 50) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-red-500/10 text-red-500 border-red-500/20";
}

export function ratingColor(rating: string): string {
  switch (rating) {
    case "pass": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "fail": return "bg-red-500/10 text-red-600 border-red-500/20";
    case "partial": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    default: return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  }
}
