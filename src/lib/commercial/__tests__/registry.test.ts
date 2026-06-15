import { describe, it, expect } from "vitest";
import { CommercialRegistry, CommercialFeatureError, openCoreRegistry } from "../registry";

describe("commercial registry — open-core seam", () => {
  it("the default open-core registry has NOTHING enabled (full eval runs without commercial code)", () => {
    expect(openCoreRegistry.enabled()).toEqual([]);
    expect(openCoreRegistry.isEnabled("sso")).toBe(false);
    expect(openCoreRegistry.isEnabled("scim")).toBe(false);
    expect(openCoreRegistry.get("pdf-render")).toBeNull();
  });

  it("require() on a disabled capability throws CommercialFeatureError (402)", () => {
    const r = new CommercialRegistry();
    try {
      r.require("sso");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CommercialFeatureError);
      expect((e as CommercialFeatureError).status).toBe(402);
      expect((e as CommercialFeatureError).capability).toBe("sso");
    }
  });

  it("registering a commercial impl enables it (cloud/enterprise build path)", async () => {
    const r = new CommercialRegistry();
    r.register("sso", {
      authorizeUrl: async (orgId) => `https://idp.test/auth?org=${orgId}`,
      callback: async () => ({ email: "u@x.test", externalId: "ext_1" }),
    });
    expect(r.isEnabled("sso")).toBe(true);
    expect(r.enabled()).toEqual(["sso"]);
    const url = await r.require("sso").authorizeUrl("org_1", "https://app/cb");
    expect(url).toContain("org=org_1");
  });

  it("a registered suite-loader can hand the engine a manifest at runtime", async () => {
    const r = new CommercialRegistry();
    r.register("suite-loader", { load: async (id) => ({ id, name: "pack", version: "1", regulation: "r", controls: [] }) });
    const manifest = (await r.require("suite-loader").load("hipaa")) as { id: string };
    expect(manifest.id).toBe("hipaa");
  });
});
