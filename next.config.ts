import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'pg'],
  // Type-checking/linting runs in CI (`npm run typecheck`); skip it during the
  // Docker build so the image builds on low-RAM hosts without the type-check
  // worker OOMing.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
