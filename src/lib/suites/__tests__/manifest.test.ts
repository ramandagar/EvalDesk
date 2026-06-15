import { describe, it, expect } from "vitest";
import { parseSuiteManifest, computeCoverage, SuiteError, type SuiteManifest, type CoverageItem } from "../manifest";

// A HIPAA-shaped sample manifest (the real @evaldesk/suite-hipaa pack is
// commercial; this fixture proves the MIT engine loads + scores any conforming pack).
const HIPAA_SAMPLE: unknown = {
  id: "hipaa",
  name: "HIPAA Security Rule (sample)",
  version: "1.0.0",
  regulation: "HIPAA Security Rule",
  controls: [
    { id: "164.312(a)(1)", title: "Access control", category: "access_control", minPassRate: 1 },
    { id: "164.312(b)", title: "Audit controls", category: "audit", minPassRate: 0.8 },
    { id: "164.312(e)(1)", title: "Transmission security", category: "transmission", requireSignoff: true },
  ],
};

describe("parseSuiteManifest", () => {
  it("validates a conforming manifest", () => {
    const m = parseSuiteManifest(HIPAA_SAMPLE);
    expect(m.id).toBe("hipaa");
    expect(m.controls).toHaveLength(3);
  });

  it("rejects a manifest missing required fields", () => {
    expect(() => parseSuiteManifest({ id: "x", controls: [] })).toThrow(SuiteError);
    expect(() => parseSuiteManifest({ ...(HIPAA_SAMPLE as object), controls: [] })).toThrow(/Invalid suite manifest/);
  });

  it("rejects duplicate control ids", () => {
    const dup = { ...(HIPAA_SAMPLE as { controls: unknown[] }), controls: [{ id: "a", title: "A", category: "x" }, { id: "a", title: "B", category: "y" }] };
    expect(() => parseSuiteManifest({ id: "s", name: "S", version: "1", regulation: "r", ...dup })).toThrow(/Duplicate control id/);
  });
});

describe("computeCoverage — control-coverage matrix", () => {
  const manifest = (): SuiteManifest => parseSuiteManifest(HIPAA_SAMPLE);

  it("maps adjudicated results to controls by category and gates each", () => {
    const items: CoverageItem[] = [
      { category: "access_control", finalLabel: "pass" },
      { category: "access_control", finalLabel: "pass" }, // 100% → meets gate 1.0
      { category: "audit", finalLabel: "pass" },
      { category: "audit", finalLabel: "pass" },
      { category: "audit", finalLabel: "fail" }, // 2/3 = 0.67 < 0.8 gate → FAIL
      // "transmission" has no results → uncovered
    ];
    const report = computeCoverage(manifest(), items);

    const access = report.controls.find((c) => c.id === "164.312(a)(1)")!;
    expect(access.status).toBe("pass");
    expect(access.passRate).toBe(1);

    const audit = report.controls.find((c) => c.id === "164.312(b)")!;
    expect(audit.status).toBe("fail");
    expect(audit.passRate).toBeCloseTo(2 / 3, 5);

    const transmission = report.controls.find((c) => c.id === "164.312(e)(1)")!;
    expect(transmission.status).toBe("uncovered");
    expect(transmission.covered).toBe(false);

    expect(report.controlsTotal).toBe(3);
    expect(report.controlsCovered).toBe(2);
    expect(report.controlsPassed).toBe(1);
    expect(report.compliant).toBe(false); // not all controls pass
  });

  it("compliant only when every control is covered and passing", () => {
    const items: CoverageItem[] = [
      { category: "access_control", finalLabel: "pass" },
      { category: "audit", finalLabel: "pass" },
      { category: "transmission", finalLabel: "pass" },
    ];
    const report = computeCoverage(manifest(), items);
    expect(report.compliant).toBe(true);
    expect(report.controlsPassed).toBe(3);
  });

  it("default gate is 1.0 — a single failure fails a no-minPassRate control", () => {
    const m = parseSuiteManifest({ id: "s", name: "S", version: "1", regulation: "r", controls: [{ id: "c1", title: "C", category: "cat" }] });
    const report = computeCoverage(m, [{ category: "cat", finalLabel: "pass" }, { category: "cat", finalLabel: "fail" }]);
    expect(report.controls[0].status).toBe("fail");
  });
});
