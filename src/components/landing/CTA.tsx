import Link from "next/link";

export function CTA() {
  return (
    <section className="py-20 border-t border-black/[0.06]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-10 md:p-14 text-center">
          <h2 className="text-[28px] font-semibold tracking-tight text-[#0a0a0a] md:text-[34px]" style={{ letterSpacing: "-0.03em" }}>Get started in seconds</h2>
          <p className="mt-3 text-[15px] text-[#8a8f98] max-w-md mx-auto" style={{ letterSpacing: "-0.01em" }}>Install, deploy, and start testing your AI agents today. Free forever.</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/login" className="btn-primary text-[14px] px-7 py-3">Start testing free</Link>
            <a href="https://github.com" target="_blank" className="btn-secondary text-[14px] px-7 py-3">View on GitHub</a>
          </div>
          <div className="mt-5 rounded-xl border border-black/[0.06] bg-white p-4 font-mono text-[12px] text-left max-w-md mx-auto">
            <p className="text-[#8a8f98]">$ git clone https://github.com/evaldesk/evaldesk.git</p>
            <p className="text-[#8a8f98]">$ cd evaldesk && docker compose up -d</p>
            <p className="text-[#4E9363] mt-1">✓ Open http://localhost:3000</p>
          </div>
        </div>
      </div>
    </section>
  );
}
