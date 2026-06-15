import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "../../../scripts/gen-schema.mjs";

// Drift guard: the committed per-dialect schemas MUST equal a fresh codegen run.
// If this fails, someone hand-edited a generated file (or changed the spec
// without regenerating). Fix with: npm run db:gen
describe("schema codegen drift guard", () => {
  const { pg, sqlite } = generate() as { pg: string; sqlite: string };
  const dbDir = join(__dirname, "..");

  it("src/db/schema.pg.ts matches the spec", () => {
    const committed = readFileSync(join(dbDir, "schema.pg.ts"), "utf8");
    expect(committed).toBe(pg);
  });

  it("src/db/schema.sqlite.ts matches the spec", () => {
    const committed = readFileSync(join(dbDir, "schema.sqlite.ts"), "utf8");
    expect(committed).toBe(sqlite);
  });

  it("both dialects declare the same tables and columns (structural parity)", () => {
    const tablesIn = (src: string) =>
      [...src.matchAll(/export const (\w+) = \w+\("(\w+)", \{([\s\S]*?)\n\}/g)].map((m) => ({
        exportName: m[1],
        tableName: m[2],
        columns: [...m[3].matchAll(/^\s{2}(\w+):/gm)].map((c) => c[1]).sort(),
      }));

    const pgTables = tablesIn(pg);
    const sqliteTables = tablesIn(sqlite);

    expect(pgTables.map((t) => t.tableName)).toEqual(sqliteTables.map((t) => t.tableName));
    for (let i = 0; i < pgTables.length; i++) {
      expect(pgTables[i].columns, `columns of ${pgTables[i].tableName}`).toEqual(
        sqliteTables[i].columns,
      );
    }
  });
});
