import type { Config } from "drizzle-kit";

// Postgres (cloud / scaled self-host) migrations. Generated from the codegen output.
export default {
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
} satisfies Config;
