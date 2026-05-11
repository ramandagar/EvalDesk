"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold text-[#0a0a0a]" style={{ letterSpacing: "-0.02em" }}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ABC83A]">
            <span className="text-[11px] font-bold text-[#09090b]">E</span>
          </div>
          EvalDesk
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          <a href="/#features" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Features</a>
          <a href="/#pricing" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Pricing</a>
          <Link href="/docs" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Docs</Link>
          <Link href="/blog" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Blog</Link>
          <Link href="/changelog" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Changelog</Link>
          <a href="https://github.com" target="_blank" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>GitHub</a>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-[13px] text-[#8a8f98] hover:text-[#0a0a0a] transition" style={{ letterSpacing: "-0.01em" }}>Sign in</Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 rounded-lg bg-[#ABC83A] px-4 py-[7px] text-[13px] font-semibold text-[#09090b] hover:bg-[#9AB932] transition" style={{ letterSpacing: "-0.01em" }}>Get started free</Link>
        </div>
        <button className="md:hidden text-[#0a0a0a]" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {open && (
        <div className="border-t border-black/[0.06] bg-white px-5 py-4 md:hidden space-y-3">
          <a href="/#features" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>Features</a>
          <a href="/#pricing" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>Pricing</a>
          <Link href="/docs" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>Docs</Link>
          <Link href="/blog" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>Blog</Link>
          <Link href="/changelog" className="block text-[13px] text-[#8a8f98]" onClick={() => setOpen(false)}>Changelog</Link>
          <Link href="/login" className="block text-[13px] text-[#0a0a0a] font-medium" onClick={() => setOpen(false)}>Get started free</Link>
        </div>
      )}
    </nav>
  );
}
