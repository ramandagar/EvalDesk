import { describe, it, expect } from "vitest";
import { can, isRole, ALL_CAPABILITIES } from "@/lib/auth/roles";

describe("RBAC roles", () => {
  it("owner can do everything", () => {
    for (const cap of ALL_CAPABILITIES) expect(can("owner", cap)).toBe(true);
  });

  it("admin can manage but NOT billing (owner-only)", () => {
    expect(can("admin", "project:write")).toBe(true);
    expect(can("admin", "key:manage")).toBe(true);
    expect(can("admin", "member:manage")).toBe(true);
    expect(can("admin", "run:approve")).toBe(true);
    expect(can("admin", "billing:manage")).toBe(false);
  });

  it("reviewer can rate/adjudicate but not configure", () => {
    expect(can("reviewer", "result:rate")).toBe(true);
    expect(can("reviewer", "result:adjudicate")).toBe(true);
    expect(can("reviewer", "run:read")).toBe(true);
    expect(can("reviewer", "project:write")).toBe(false);
    expect(can("reviewer", "key:manage")).toBe(false);
    expect(can("reviewer", "run:execute")).toBe(false);
  });

  it("viewer is read-only", () => {
    expect(can("viewer", "org:read")).toBe(true);
    expect(can("viewer", "project:read")).toBe(true);
    expect(can("viewer", "run:read")).toBe(true);
    expect(can("viewer", "result:rate")).toBe(false);
    expect(can("viewer", "project:write")).toBe(false);
  });

  it("isRole validates role strings", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("superadmin")).toBe(false);
  });
});
