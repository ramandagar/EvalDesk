"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden surface-base">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ThemeProvider>
  );
}
