import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, buildPage, clampLimit, CursorError, DEFAULT_LIMIT, MAX_LIMIT } from "../cursor";

describe("cursor encode/decode", () => {
  it("round-trips a keyset position scoped to org + resource", () => {
    const c = encodeCursor({ createdAt: 1700000000000, id: "abc" }, "org_1", "projects");
    expect(decodeCursor(c, "org_1", "projects")).toEqual({ createdAt: 1700000000000, id: "abc" });
  });

  it("REJECTS a cursor replayed in another org (IDOR defense)", () => {
    const c = encodeCursor({ createdAt: 1, id: "x" }, "org_1", "projects");
    expect(() => decodeCursor(c, "org_2", "projects")).toThrow(CursorError);
  });

  it("REJECTS a cursor replayed on another resource", () => {
    const c = encodeCursor({ createdAt: 1, id: "x" }, "org_1", "projects");
    expect(() => decodeCursor(c, "org_1", "runs")).toThrow(/different resource/);
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeCursor("!!!notbase64!!!", "o", "r")).toThrow(CursorError);
    expect(() => decodeCursor(Buffer.from('{"x":1}').toString("base64url"), "o", "r")).toThrow(/Malformed/);
  });
});

describe("clampLimit", () => {
  it("defaults and clamps", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(0)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(99999)).toBe(MAX_LIMIT);
  });
});

describe("buildPage", () => {
  const keyOf = (r: { createdAt: number; id: string }) => ({ createdAt: r.createdAt, id: r.id });
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ createdAt: i, id: `id${i}` }));

  it("no extra row → hasMore false, nextCursor null", () => {
    const p = buildPage(rows(3), 5, "o", "projects", keyOf);
    expect(p.data).toHaveLength(3);
    expect(p.page.hasMore).toBe(false);
    expect(p.page.nextCursor).toBeNull();
  });

  it("over-fetched (limit+1) → trims, sets hasMore + a cursor from the last KEPT row", () => {
    const p = buildPage(rows(6), 5, "o", "projects", keyOf);
    expect(p.data).toHaveLength(5);
    expect(p.page.hasMore).toBe(true);
    // cursor points at row index 4 (the last kept), not the dropped 6th
    expect(decodeCursor(p.page.nextCursor!, "o", "projects")).toEqual({ createdAt: 4, id: "id4" });
  });
});
