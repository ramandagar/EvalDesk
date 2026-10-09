import type { Config } from "drizzle-kit";

const isPostgres = Boolean(process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith("postgres://") || process.env.DATABASE_URL.startsWith("postgresql://")));

export default {
  schema: isPostgres ? "./src/db/schema.pg.ts" : "./src/db/schema.sqlite.ts",
  out: isPostgres ? "./drizzle/pg" : "./drizzle/sqlite",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./data/evaldesk.db",
  },
} satisfies Config;
