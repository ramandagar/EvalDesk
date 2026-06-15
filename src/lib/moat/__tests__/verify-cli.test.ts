import { describe, it, expect } from "vitest";
import { buildCertificatePayload, signCertificate } from "../certificate";
import { generateSigningKeyPair } from "@/lib/crypto/signing";
// The standalone, zero-dependency offline verifier (re-implements JCS + Ed25519).
import { verifyCertificateBundle } from "../../../../scripts/verify-cert.mjs";

function makeCert() {
  const kp = generateSigningKeyPair();
  const payload = buildCertificatePayload({
    orgId: "org_1",
    runId: "run_1",
    projectId: "proj_1",
    judgeModel: "deepseek-chat",
    kappa: 0.416667,
    kappaMethod: "cohen",
    kappaN: 12,
    agreementPct: 0.833333,
    reviewers: [{ reviewerId: "rev_1", role: "reviewer" }],
    verdicts: [{ runResultId: "rr_1", finalLabel: "pass", judgeLabel: "pass" }],
    signedAt: 1780358961767,
  });
  return signCertificate(payload, { privateKeyPem: kp.privateKeyPem, publicKeyPem: kp.publicKeyPem, signingKeyId: "k1" });
}

describe("offline verify CLI ⇔ server cross-implementation parity", () => {
  it("the standalone verifier accepts a server-signed certificate", () => {
    const cert = makeCert();
    // Round-trip through JSON, as a downloaded cert.json would.
    const bundle = JSON.parse(JSON.stringify(cert));
    const r = verifyCertificateBundle(bundle);
    expect(r.valid).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it("the standalone verifier rejects a tampered payload", () => {
    const cert = makeCert();
    const bundle = JSON.parse(JSON.stringify(cert));
    bundle.payload.runId = "run_hacked";
    const r = verifyCertificateBundle(bundle);
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain("canonical-json-mismatch");
  });

  it("the standalone verifier rejects a flipped signature byte", () => {
    const cert = makeCert();
    const bundle = JSON.parse(JSON.stringify(cert));
    // flip a char in the base64 signature
    bundle.signature = bundle.signature[0] === "A" ? "B" + bundle.signature.slice(1) : "A" + bundle.signature.slice(1);
    expect(verifyCertificateBundle(bundle).valid).toBe(false);
  });

  it("independently re-derives the same canonical JSON the server signed (no callback)", () => {
    const cert = makeCert();
    const bundle = JSON.parse(JSON.stringify(cert));
    // The CLI does not trust the embedded canonicalJson — drop it and it still verifies.
    delete bundle.canonicalJson;
    delete bundle.contentHash;
    expect(verifyCertificateBundle(bundle).valid).toBe(true);
  });
});
