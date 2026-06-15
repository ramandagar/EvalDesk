"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
    if (res.ok) router.push("/login");
    else setError((await res.json().catch(() => ({}))).error ?? "Reset failed");
    setLoading(false);
  }
  if (!token) return <p className="text-[13px] text-[#8a8f98]">Invalid reset link. <Link href="/forgot" className="hover:underline">Request a new one</Link>.</p>;
  return (
    <form onSubmit={submit} className="space-y-3 mt-3">
      {error && <div className="rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2 text-[12px] text-red-500">{error}</div>}
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 8 chars)" required minLength={8} className="input" />
      <button disabled={loading || password.length < 8} className="btn-primary w-full py-2.5">{loading ? "Saving…" : "Set new password"}</button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#09090b]">
      <div className="w-full max-w-sm px-5">
        <div className="card p-6">
          <h1 className="text-[17px] font-semibold">Choose a new password</h1>
          <Suspense fallback={<p className="text-[13px] text-[#8a8f98] mt-3">Loading…</p>}><ResetForm /></Suspense>
        </div>
      </div>
    </div>
  );
}
