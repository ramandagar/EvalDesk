"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user)).catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex h-[52px] items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-[#0f1011] px-5">
      <div>
        <h1
          className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]" style={{ letterSpacing: "-0.01em" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        {user && (
          <>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ABC83A] text-[11px] font-bold text-[#09090b]" style={{ letterSpacing: "-0.01em" }}>
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="text-[12px] text-[#8a8f98] dark:text-[#62666d] hidden md:block max-w-[120px] truncate" style={{ letterSpacing: "-0.01em" }}>
              {user.name || user.email}
            </span>
          </>
        )}
        <button
          onClick={handleLogout}
          className="ml-0.5 p-1.5 rounded-lg text-[#8a8f98] dark:text-[#62666d] hover:text-[#0a0a0a] dark:hover:text-[#f7f8f8] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all duration-150"
          title="Sign out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
