// ============================================================================
// Pluggable email sender. Self-host default is the CONSOLE sender (the message —
// including any reset link — is logged, so a single-node operator can read it
// from the logs). Set EVALDESK_SMTP_URL to send real email via nodemailer
// (lazy-imported, so it's an optional dependency, never required to build/run).
// ============================================================================

import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<void>;
}

const emailLog = logger.child({ component: "email" });

export const consoleEmailSender: EmailSender = {
  async send(msg) {
    // The full body is intentional: in self-host this IS the delivery channel
    // (e.g. the password-reset link). Route it through the structured logger so
    // it lands in the same machine-parseable stream as everything else.
    emailLog.info("delivered (console)", { to: msg.to, subject: msg.subject, body: msg.text });
  },
};

export async function resolveEmailSender(): Promise<EmailSender> {
  const url = process.env.EVALDESK_SMTP_URL;
  if (!url) return consoleEmailSender;
  try {
    // Variable specifier keeps nodemailer an OPTIONAL dependency (no build-time
    // resolution); install it only when you want SMTP delivery.
    const mod = "nodemailer";
    const nodemailer = (await import(mod)) as unknown as {
      createTransport: (u: string) => { sendMail: (o: Record<string, unknown>) => Promise<unknown> };
    };
    const transport = nodemailer.createTransport(url);
    const from = process.env.EVALDESK_EMAIL_FROM || "EvalDesk <noreply@evaldesk.dev>";
    return {
      async send(msg) {
        await transport.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text });
      },
    };
  } catch {
    // nodemailer not installed / SMTP misconfigured → don't break, fall back.
    emailLog.warn("SMTP sender unavailable, falling back to console", {});
    return consoleEmailSender;
  }
}
