"use client";

import { useState, FormEvent } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", data.error || "Something went wrong.");
        return;
      }

      showToast("success", "Message sent! We will get back to you soon.");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      showToast("error", "Failed to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-right">
          <div
            className={`rounded-lg border px-4 py-3 text-[14px] shadow-lg ${
              toast.type === "success"
                ? "bg-white border-[#ABC83A]/20 text-[#0a0a0a]"
                : "bg-white border-red-200 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <svg
                  className="w-4 h-4 text-[#ABC83A]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              {toast.message}
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="pt-24 pb-12 text-center max-w-6xl mx-auto px-5">
        <span className="section-label">Contact</span>
        <h1
          className="text-[32px] font-semibold text-[#0a0a0a] mt-5"
          style={{ letterSpacing: "-0.03em" }}
        >
          Get in touch
        </h1>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 max-w-xl mx-auto">
          Have a question, feedback, or want to learn more? We would love to
          hear from you.
        </p>
      </section>

      {/* Two column layout */}
      <section className="pb-20 max-w-6xl mx-auto px-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left - Contact info */}
          <div>
            <h2
              className="text-[20px] font-semibold text-[#0a0a0a]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Contact information
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3">
              Reach out through any of these channels and we will respond within
              24 hours.
            </p>

            <div className="mt-8 space-y-5">
              <a
                href="mailto:hello@evaldesk.dev"
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#ABC83A]/10 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[#ABC83A]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#0a0a0a] group-hover:text-[#ABC83A] transition-colors">
                    Email
                  </p>
                  <p className="text-[13px] text-[#8a8f98]">
                    hello@evaldesk.dev
                  </p>
                </div>
              </a>

              <a
                href="https://twitter.com/evaldesk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#ABC83A]/10 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[#ABC83A]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#0a0a0a] group-hover:text-[#ABC83A] transition-colors">
                    Twitter / X
                  </p>
                  <p className="text-[13px] text-[#8a8f98]">@evaldesk</p>
                </div>
              </a>

              <a
                href="https://github.com/evaldesk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#ABC83A]/10 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[#ABC83A]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#0a0a0a] group-hover:text-[#ABC83A] transition-colors">
                    GitHub
                  </p>
                  <p className="text-[13px] text-[#8a8f98]">github.com/evaldesk</p>
                </div>
              </a>
            </div>
          </div>

          {/* Right - Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-[#0a0a0a] block mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#0a0a0a] block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#0a0a0a] block mb-1.5">
                  Subject
                </label>
                <select
                  className="input"
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  required
                >
                  <option value="">Select a subject</option>
                  <option value="general">General inquiry</option>
                  <option value="support">Technical support</option>
                  <option value="sales">Sales & pricing</option>
                  <option value="partnership">Partnership</option>
                  <option value="feedback">Product feedback</option>
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#0a0a0a] block mb-1.5">
                  Message
                </label>
                <textarea
                  className="input min-h-[120px] resize-y"
                  placeholder="Tell us how we can help..."
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  required
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full py-3 text-[14px]"
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Send message"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
