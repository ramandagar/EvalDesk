import { describe, it, expect } from "vitest";
import { parseSuiteManifest, computeCoverage, type CoverageItem } from "../manifest";
import { HIPAA_MANIFEST } from "../packs/hipaa";
import { getSuitePack, listSuitePacks } from "../packs";

describe("HIPAA pack — real content, engine-valid", () => {
  it("is a structurally valid manifest (parses, unique controls, cited)", () => {
    const m = parseSuiteManifest(HIPAA_MANIFEST); // throws on any schema violation
    expect(m.id).toBe("hipaa");
    expect(m.controls.length).toBeGreaterThanOrEqual(8);
    // real HIPAA citations present
    expect(m.controls.some((c) => c.id === "164.312(a)(1)")).toBe(true);
    expect(m.controls.some((c) => c.id === "164.312(e)(1)")).toBe(true);
    // every control maps to an eval category
    expect(m.controls.every((c) => c.category.length > 0)).toBe(true);
  });

  it("is reachable from the pack registry", () => {
    expect(getSuitePack("hipaa")?.id).toBe("hipaa");
    expect(getSuitePack("nonexistent")).toBeUndefined();
    expect(listSuitePacks().map((p) => p.id)).toContain("hipaa");
  });

  it("computes a control-coverage matrix from a run's results", () => {
    const items: CoverageItem[] = [
      { category: "access_control", finalLabel: "pass" },
      { category: "audit_logging", finalLabel: "pass" },
      { category: "audit_logging", finalLabel: "fail" }, // 0.5 < 0.9 gate → control FAIL
      { category: "data_integrity", finalLabel: "pass" },
      { category: "transmission_security", finalLabel: "pass" },
      // authentication, encryption, workforce_access, contingency, minimum_necessary,
      // deidentification have NO results → uncovered
    ];
    const report = computeCoverage(HIPAA_MANIFEST, items);
    const access = report.controls.find((c) => c.id === "164.312(a)(1)")!;
    expect(access.status).toBe("pass"); // 100% ≥ 1.0 gate
    const audit = report.controls.find((c) => c.id === "164.312(b)")!;
    expect(audit.status).toBe("fail"); // 0.5 < 0.9
    const auth = report.controls.find((c) => c.id === "164.312(d)")!;
    expect(auth.status).toBe("uncovered"); // no results for "authentication"
    expect(report.compliant).toBe(false); // not all controls pass
    expect(report.controlsCovered).toBe(4);
  });
});
