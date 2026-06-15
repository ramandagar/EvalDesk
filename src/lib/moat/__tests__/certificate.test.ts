import { describe, it, expect } from "vitest";
import {
  buildCertificatePayload,
  signCertificate,
  verifyCertificate,
  normalizeForCertificate,
  type CertificatePayloadInput,
} from "../certificate";

// Fixed test keypair so the certificate is byte-reproducible (Ed25519 is
// deterministic). This is the "golden-certificate" gate: the canonical JSON,
// content hash, and signature must be identical across drivers + Node versions.
const TEST_PUB = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAUmaHwkqd8GBCAtmGTNkBtqHuzB7SfVjVi4ftIQgmrTI=
-----END PUBLIC KEY-----
`;
const TEST_PRIV = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEINtiW+crbZPog/J7QcXqSJelVqaFL4mHoCxeeT+8xSjo
-----END PRIVATE KEY-----
`;

function goldenInput(): CertificatePayloadInput {
  return {
    orgId: "org_1",
    runId: "run_1",
    projectId: "proj_1",
    datasetVersion: "v3",
    judgeModel: "deepseek-chat",
    judgePromptHash: "abc123",
    weightingScheme: "quadratic",
    kappa: 0.4166666667, // must round to 0.416667
    kappaMethod: "cohen",
    kappaN: 12,
    kappaCi: [0.21, 0.63],
    agreementPct: 0.8333333,
    calibrationGap: 0.1,
    reviewers: [{ reviewerId: "rev_1", role: "reviewer", credentialKind: "md", credentialVerified: false }],
    verdicts: [{ runResultId: "rr_1", finalLabel: "pass", judgeLabel: "pass", humanLabel: "pass" }],
    signoffPolicy: { minReviewers: 1, requiredRole: "reviewer" },
    signedAt: 1780358961767,
  };
}

describe("normalizeForCertificate", () => {
  it("rounds non-integer reals to 6 dp, keeps integers", () => {
    expect(normalizeForCertificate(0.4166666667)).toBe(0.416667);
    expect(normalizeForCertificate(12)).toBe(12);
    expect(normalizeForCertificate(1780358961767)).toBe(1780358961767);
  });
  it("drops null/undefined object members", () => {
    expect(normalizeForCertificate({ a: 1, b: null, c: undefined })).toEqual({ a: 1 });
  });
  it("rejects non-finite numbers", () => {
    expect(() => normalizeForCertificate(NaN)).toThrow();
  });
});

describe("buildCertificatePayload", () => {
  it("rounds reals and omits empty branches", () => {
    const p = buildCertificatePayload(goldenInput()) as Record<string, Record<string, unknown>>;
    expect(p.agreement.kappa).toBe(0.416667);
    expect(p.calibration.agreementPct).toBe(0.833333);
    expect(p.certVersion).toBe(1);
  });
  it("omits null kappa rather than emitting null", () => {
    const p = buildCertificatePayload({ ...goldenInput(), kappa: null }) as Record<string, Record<string, unknown>>;
    expect("kappa" in p.agreement).toBe(false);
  });
});

describe("signCertificate / verifyCertificate", () => {
  it("a freshly signed certificate verifies offline", () => {
    const payload = buildCertificatePayload(goldenInput());
    const cert = signCertificate(payload, { privateKeyPem: TEST_PRIV, publicKeyPem: TEST_PUB, signingKeyId: "k1" });
    const v = verifyCertificate(cert);
    expect(v.valid).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it("GOLDEN: canonical JSON + content hash + signature are byte-stable", () => {
    const payload = buildCertificatePayload(goldenInput());
    const cert = signCertificate(payload, { privateKeyPem: TEST_PRIV, publicKeyPem: TEST_PUB, signingKeyId: "k1" });
    // Frozen expected values — any drift in canonicalization or normalization breaks these.
    expect(cert.canonicalJson).toBe(
      '{"agreement":{"ciHi":0.63,"ciLo":0.21,"kappa":0.416667,"method":"cohen","n":12,"weightingScheme":"quadratic"},' +
        '"calibration":{"agreementPct":0.833333,"gap":0.1},"certVersion":1,"datasetVersion":"v3",' +
        '"judge":{"model":"deepseek-chat","promptHash":"abc123"},"orgId":"org_1","projectId":"proj_1",' +
        '"reviewers":[{"credentialKind":"md","credentialVerified":false,"reviewerId":"rev_1","role":"reviewer"}],' +
        '"runId":"run_1","signedAt":1780358961767,"signoffPolicy":{"minReviewers":1,"requiredRole":"reviewer"},' +
        '"verdicts":[{"finalLabel":"pass","humanLabel":"pass","judgeLabel":"pass","runResultId":"rr_1"}]}',
    );
    expect(cert.contentHash).toBe("48c5e1bd1ab93f9852d003d80db25c24a91c991794759e7164a083a5f01f0d5f");
    expect(cert.signature).toBe("D/pdhuC7iz8PDuLE7TmR7rRtIKXsDHregQeMq5jCtVvWvxaf0reh4xG5C/FeVNXyqMjI3H4dHfu7zlItRD7IBw==");
  });

  it("detects a flipped payload byte (tamper) on offline verify", () => {
    const payload = buildCertificatePayload(goldenInput());
    const cert = signCertificate(payload, { privateKeyPem: TEST_PRIV, publicKeyPem: TEST_PUB, signingKeyId: "k1" });
    // Tamper with the payload AFTER signing — verify must fail.
    const tampered = { ...cert, payload: { ...cert.payload, runId: "run_hacked" } };
    const v = verifyCertificate(tampered);
    expect(v.valid).toBe(false);
    expect(v.reasons).toContain("canonical-json-mismatch");
  });

  it("detects a forged canonicalJson that no longer matches the payload", () => {
    const payload = buildCertificatePayload(goldenInput());
    const cert = signCertificate(payload, { privateKeyPem: TEST_PRIV, publicKeyPem: TEST_PUB, signingKeyId: "k1" });
    const forged = { ...cert, canonicalJson: cert.canonicalJson.replace("pass", "fail") };
    expect(verifyCertificate(forged).valid).toBe(false);
  });
});
