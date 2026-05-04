"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: isSignup ? name : undefined,
          password,
          action: isSignup ? "signup" : "login",
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        if (data.isFirstUser) {
          await fetch("/api/seed", { method: "POST" });
        }
        router.push("/dashboard");
      } else {
        setError(data.error || "Failed to sign in");
      }
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#09090b]">
      <div className="w-full max-w-sm px-5">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ABC83A]">
            <span className="text-[16px] font-bold text-[#09090b]" style={{ letterSpacing: "-0.02em" }}>E</span>
          </div>
          <h1 className="text-[17px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
            EvalDesk
          </h1>
          <p className="mt-1 text-[13px] text-[#8a8f98] dark:text-[#62666d]">Test AI agents without code</p>
        </div>

        <div className="card p-6">
          {/* Tab switcher */}
          <div className="flex mb-5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] p-1">
            <button
              onClick={() => { setIsSignup(false); setError(""); }}
              className={`flex-1 rounded-md py-1.5 text-[13px] font-medium transition-all duration-150 ${!isSignup ? "bg-white dark:bg-[#191a1b] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm" : "text-[#8a8f98] dark:text-[#62666d]"}`}
              style={{ letterSpacing: "-0.01em" }}
            >
              Sign in
            </button>
            <button
              onClick={() => { setIsSignup(true); setError(""); }}
              className={`flex-1 rounded-md py-1.5 text-[13px] font-medium transition-all duration-150 ${isSignup ? "bg-white dark:bg-[#191a1b] text-[#0a0a0a] dark:text-[#f7f8f8] shadow-sm" : "text-[#8a8f98] dark:text-[#62666d]"}`}
              style={{ letterSpacing: "-0.01em" }}
            >
              Sign up
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2 text-[12px] text-red-500">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignup && (
              <div>
                <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Sharma" className="input" />
              </div>
            )}
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="input" />
            </div>
            <div>
              <label className="block text-[12px] text-[#8a8f98] dark:text-[#62666d] mb-1" style={{ letterSpacing: "-0.01em" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSignup ? "Min 6 characters" : "Your password"} required minLength={6} className="input" />
            </div>
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full py-2.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isSignup ? "Create account" : "Sign in"} <ArrowRight size={14} /></>}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-[#8a8f98] dark:text-[#62666d]">
            Self-hosted &middot; Your data stays on your server
          </p>
        </div>
      </div>
    </div>
  );
}
