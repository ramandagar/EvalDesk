import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // DB integration tests share one Postgres instance and reset it per test,
    // so test FILES must not run concurrently. The suite is fast; the cost is
    // negligible. (Within a file, tests already run sequentially.)
    fileParallelism: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // E2E (Playwright) lives under e2e/ and is run separately, not by Vitest.
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**"],
      exclude: ["**/*.test.ts", "**/__tests__/**", "**/types.ts"],
    },
  },
});
