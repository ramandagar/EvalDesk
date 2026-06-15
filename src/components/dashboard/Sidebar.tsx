"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FolderKanban, PanelLeftClose, PanelLeft,
  Moon, Sun, Settings, FileText, Cpu, Webhook, LogOut, Play, BarChart3, GitCompare, KeyRound, Users
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { logout } from "@/lib/client/api";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/runs", label: "Runs", icon: Play },
  { href: "/test-cases", label: "Test Cases", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/compare", label: "Compare", icon: GitCompare },
];

const secondaryNav = [
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/team", label: "Team", icon: Users },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle } = useTheme();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className={`flex h-screen flex-col surface-panel transition-all duration-200 ${collapsed ? "w-[52px]" : "w-[208px]"}`}>
      {/* Logo */}
      <div className="flex h-[52px] items-center gap-2.5 px-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ABC83A] shrink-0">
          <span className="text-[12px] font-bold text-[#09090b]">E</span>
        </div>
        {!collapsed && (
          <span className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
            EvalDesk
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {mainNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-[#ABC83A]/10 text-[#ABC83A]"
                  : "text-[#8a8f98] dark:text-[#62666d] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-[#0a0a0a] dark:hover:text-[#d0d6e0]"
              }`}
              style={{ letterSpacing: "-0.01em" }}
            >
              <item.icon className="h-[15px] w-[15px] shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}

        <div className="my-2 border-t border-black/[0.06] dark:border-white/[0.06]" />

        {secondaryNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-[#ABC83A]/10 text-[#ABC83A]"
                  : "text-[#8a8f98] dark:text-[#62666d] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-[#0a0a0a] dark:hover:text-[#d0d6e0]"
              }`}
              style={{ letterSpacing: "-0.01em" }}
            >
              <item.icon className="h-[15px] w-[15px] shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06] p-2 space-y-0.5">
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 w-full rounded-lg px-2.5 py-[6px] text-[12px] text-[#8a8f98] dark:text-[#62666d] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all duration-150"
        >
          <LogOut size={13} /> {!collapsed && "Sign out"}
        </button>
        <div className="flex items-center justify-between">
          <button
            onClick={toggle}
            className="flex items-center gap-2 rounded-lg px-2.5 py-[6px] text-[#8a8f98] dark:text-[#62666d] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all duration-150"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {!collapsed && <span className="text-[12px]" style={{ letterSpacing: "-0.01em" }}>{theme === "dark" ? "Light" : "Dark"}</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center py-[6px] px-1.5 text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#d0d6e0] transition-all duration-150"
          >
            {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
