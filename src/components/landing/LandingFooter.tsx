import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-black/[0.06] py-8">
      <div className="mx-auto max-w-6xl px-5 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-6 text-[12px] text-[#8a8f98]">
          <Link href="/" className="text-[#0a0a0a] font-medium text-[13px]" style={{ letterSpacing: "-0.01em" }}>EvalDesk</Link>
          <a href="#features">Features</a>
          <a href="#use-cases">Use cases</a>
          <a href="#faq">FAQ</a>
        </div>
        <p className="text-[12px] text-[#8a8f98]">&copy; {new Date().getFullYear()} EvalDesk. MIT License.</p>
      </div>
    </footer>
  );
}
