"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="text-[15px] font-semibold text-[#0a0a0a]" style={{ letterSpacing: "-0.02em" }}>EvalDesk</Link>
        <div className="hidden items-center gap-7 md:flex">
          <a href="#features" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Features</a>
          <a href="#use-cases" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Use cases</a>
          <a href="#faq" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>FAQ</a>
          <a href="https://github.com" target="_blank" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>GitHub</a>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Sign in</Link>
          <Link href="/login" className="btn-primary text-[13px] !py-[7px]">Get started free</Link>
        </div>
        <button className="md:hidden text-[#0a0a0a]" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {open && (
        <div className="border-t border-black/[0.06] bg-white px-5 py-4 md:hidden space-y-3">
          <a href="#features" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>Features</a>
          <a href="#use-cases" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>Use cases</a>
          <a href="#faq" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>FAQ</a>
          <Link href="/login" className="block text-[13px] text-[#0a0a0a] font-medium">Get started free</Link>
        </div>
      )}
    </nav>
  );
}
