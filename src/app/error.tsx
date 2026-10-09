"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log to error reporting service
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Something went wrong</h2>
      <p className="text-sm text-[#8a8f98] mt-2 max-w-md">
        An unexpected error occurred while rendering this page.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => reset()}
          className="btn-primary text-xs px-4 py-2"
        >
          Try again
        </button>
        <Link href="/" className="btn-secondary text-xs px-4 py-2">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
