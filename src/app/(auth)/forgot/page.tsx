"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    setSent(true);
    setLoading(false);
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#09090b]">
      <div className="w-full max-w-sm px-5">
        <div className="card p-6">
          <h1 className="text-[17px] font-semibold mb-1">Reset password</h1>
          {sent ? (
            <p className="text-[13px] text-[#8a8f98] mt-3">If an account exists for <b>{email}</b>, a reset link is on its way. Check your email (or the server logs in self-host).</p>
          ) : (
            <form onSubmit={submit} className="space-y-3 mt-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="input" />
              <button disabled={loading || !email} className="btn-primary w-full py-2.5">{loading ? "Sending…" : "Send reset link"}</button>
            </form>
          )}
          <p className="mt-5 text-center text-[12px] text-[#8a8f98]"><Link href="/login" className="hover:underline">Back to sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
