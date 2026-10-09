import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "EvalDesk — AI-Native Evaluations. Expert-Verified.",
  description: "Open-source evaluation and compliance infrastructure for AI agents. Automated multi-model LLM judges with credentialed domain expert verification and cryptographic audit certificates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#FEFEFE',
              fontSize: 13,
            },
          }}
        />
      </body>
    </html>
  );
}
