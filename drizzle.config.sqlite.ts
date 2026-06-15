import type { Config } from "drizzle-kit";

// SQLite (self-host) migrations. Generated from the codegen output.
export default {
  schema: "./src/db/schema.sqlite.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
} satisfies Config;
