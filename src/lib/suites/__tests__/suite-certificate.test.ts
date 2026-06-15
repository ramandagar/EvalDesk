import { describe, it, expect } from "vitest";
import { parseSuiteManifest, computeCoverage } from "../manifest";
import { buildCertificatePayload, signCertificate, verifyCertificate } from "@/lib/moat/certificate";
import { generateSigningKeyPair } from "@/lib/crypto/signing";

const SAMPLE = {
  id: "hipaa",
  name: "HIPAA (sample)",
  version: "1.0.0",
  regulation: "HIPAA Security Rule",
  controls: [
    { id: "164.312(a)(1)", title: "Access control", category: "access_control" },
    { id: "164.312(b)", title: "Audit controls", category: "audit", minPassRate: 0.5 },
  ],
};

describe("suite coverage → signed certificate", () => {
  it("a suite-scoped run's control-coverage matrix is signed into the certificate", () => {
    const manifest = parseSuiteManifest(SAMPLE);
    const coverage = computeCoverage(manifest, [
      { category: "access_control", finalLabel: "pass" },
      { category: "audit", finalLabel: "pass" },
      { category: "audit", finalLabel: "fail" }, // 0.5 == gate 0.5 → pass
    ]);
    expect(coverage.compliant).toBe(true);

    const payload = buildCertificatePayload({
      orgId: "o",
      runId: "r",
      projectId: "p",
      signedAt: 1780358961767,
      suiteCoverage: {
        suiteId: coverage.suiteId,
        version: coverage.version,
        regulation: manifest.regulation,
        compliant: coverage.compliant,
        controlsCovered: coverage.controlsCovered,
        controlsTotal: coverage.controlsTotal,
        controls: coverage.controls.map((c) => ({ id: c.id, status: c.status, passRate: c.passRate })),
      },
    });

    // the coverage is embedded in the signed bytes
    const sc = (payload as Record<string, Record<string, unknown>>).suiteCoverage;
    expect(sc.suiteId).toBe("hipaa");
    expect(sc.compliant).toBe(true);
    expect((sc.controls as unknown[]).length).toBe(2);

    const kp = generateSigningKeyPair();
    const cert = signCertificate(payload, { privateKeyPem: kp.privateKeyPem, publicKeyPem: kp.publicKeyPem, signingKeyId: "k1" });
    expect(verifyCertificate(cert).valid).toBe(true);
    // tampering with a control's status breaks verification
    const tampered = { ...cert, payload: JSON.parse(JSON.stringify(cert.payload)) };
    (tampered.payload as Record<string, Record<string, unknown[]>>).suiteCoverage.controls[1] = { id: "x", status: "pass", passRate: 1 };
    expect(verifyCertificate(tampered).valid).toBe(false);
  });
});
