"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/Header";
import { Settings as SettingsIcon, LogOut, Moon, Sun, User } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { toast } from "sonner";

export default function GlobalSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [name, setName] = useState("");
  const { theme, toggle } = useTheme();

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) { setUser(d.user); setName(d.user.name); }
    }).catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleResetDemo() {
    try {
      await fetch("/api/seed?reset=true", { method: "POST" });
      toast.success("Demo data reset");
      window.location.reload();
    } catch { toast.error("Failed"); }
  }

  return (
    <div>
      <DashboardHeader title="Settings" subtitle="App preferences and account" />
      <div className="p-5 max-w-2xl space-y-5">
        {/* Profile */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={15} className="text-[#8a8f98] dark:text-[#62666d]" />
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Account</h3>
          </div>
          {user && (
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Email</label>
                <input value={user.email} readOnly className="input bg-black/[0.04] dark:bg-white/[0.04] text-[#8a8f98] dark:text-[#62666d]" />
              </div>
            </div>
          )}
        </div>

        {/* Appearance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={15} className="text-[#8a8f98] dark:text-[#62666d]" />
            <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>Appearance</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.01em" }}>Dark mode</p>
              <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]">Toggle between light and dark themes</p>
            </div>
            <button
              onClick={toggle}
              className="btn-secondary"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        {/* Data */}
        <div className="card p-5">
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8] mb-3" style={{ letterSpacing: "-0.02em" }}>Data</h3>
          <button onClick={handleResetDemo} className="btn-secondary">
            Reset demo data
          </button>
        </div>

        {/* Sign out */}
        <div className="card p-5">
          <button onClick={handleLogout} className="flex items-center gap-2 text-[13px] text-red-500 hover:text-red-600 transition">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
