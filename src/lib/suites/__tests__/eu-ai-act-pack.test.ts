import { describe, it, expect } from "vitest";
import { parseSuiteManifest, computeCoverage, type CoverageItem } from "../manifest";
import { EU_AI_ACT_MANIFEST } from "../packs/eu-ai-act";
import { getSuitePack, listSuitePacks } from "../packs";

describe("EU AI Act pack — real content, engine-valid", () => {
  it("is a structurally valid manifest (parses, unique controls, cited)", () => {
    const m = parseSuiteManifest(EU_AI_ACT_MANIFEST); // throws on any schema violation
    expect(m.id).toBe("eu-ai-act");
    expect(m.controls.length).toBe(5);
    // real EU AI Act article citations present
    expect(m.controls.some((c) => c.id === "Art-14")).toBe(true);
    expect(m.controls.some((c) => c.id === "Art-9")).toBe(true);
    // every control maps to an eval category
    expect(m.controls.every((c) => c.category.length > 0)).toBe(true);
  });

  it("is reachable from the pack registry", () => {
    expect(getSuitePack("eu-ai-act")?.id).toBe("eu-ai-act");
    expect(getSuitePack("nonexistent")).toBeUndefined();
    expect(listSuitePacks().map((p) => p.id)).toContain("eu-ai-act");
  });

  it("computes a control-coverage matrix from a run's results", () => {
    const items: CoverageItem[] = [
      { category: "human_oversight", finalLabel: "pass" }, // Art-14: 1/1 ≥ 1.0 gate → pass
      { category: "risk_management", finalLabel: "pass" },
      { category: "risk_management", finalLabel: "fail" }, // 0.5 < 0.9 gate → fail
      // data_governance, transparency, accuracy_robustness have NO results → uncovered
    ];
    const report = computeCoverage(EU_AI_ACT_MANIFEST, items);

    const humanOversight = report.controls.find((c) => c.id === "Art-14")!;
    expect(humanOversight.status).toBe("pass"); // 100% ≥ 1.0 gate

    const riskMgmt = report.controls.find((c) => c.id === "Art-9")!;
    expect(riskMgmt.status).toBe("fail"); // 0.5 < 0.9 gate

    const dataGov = report.controls.find((c) => c.id === "Art-10")!;
    expect(dataGov.status).toBe("uncovered"); // no results for "data_governance"

    expect(report.compliant).toBe(false); // not all controls pass
    expect(report.controlsCovered).toBe(2); // human_oversight + risk_management
    expect(report.controlsTotal).toBe(5);
  });
});
