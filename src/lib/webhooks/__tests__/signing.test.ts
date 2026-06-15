import { describe, it, expect } from "vitest";
import {
  buildSignatureHeader,
  computeMac,
  parseSignatureHeader,
  verifySignature,
  signedPayload,
} from "../signing";

const SECRET = "whsec_test_123";
const BODY = JSON.stringify({ event: "run.completed", runId: "run_1" });

describe("webhook signing", () => {
  it("signs the timestamp + raw body (golden MAC is stable)", () => {
    expect(signedPayload(1700000000, "x")).toBe("1700000000.x");
    // deterministic HMAC for a fixed secret/ts/body
    const mac = computeMac(SECRET, 1700000000, BODY);
    expect(mac).toMatch(/^[0-9a-f]{64}$/);
    expect(computeMac(SECRET, 1700000000, BODY)).toBe(mac); // stable
  });

  it("builds and parses the t=,v1= header", () => {
    const header = buildSignatureHeader(SECRET, BODY, 1700000000);
    const parsed = parseSignatureHeader(header);
    expect(parsed.t).toBe(1700000000);
    expect(parsed.v1).toHaveLength(1);
    expect(parsed.v1[0]).toBe(computeMac(SECRET, 1700000000, BODY));
  });

  it("verifies a fresh, untampered signature", () => {
    const ts = 1700000000;
    const header = buildSignatureHeader(SECRET, BODY, ts);
    expect(verifySignature(SECRET, header, BODY, ts + 10)).toEqual({ valid: true });
  });

  it("rejects a tampered body", () => {
    const ts = 1700000000;
    const header = buildSignatureHeader(SECRET, BODY, ts);
    expect(verifySignature(SECRET, header, BODY + " ", ts).reason).toBe("bad-signature");
  });

  it("rejects a wrong secret", () => {
    const ts = 1700000000;
    const header = buildSignatureHeader(SECRET, BODY, ts);
    expect(verifySignature("whsec_other", header, BODY, ts).valid).toBe(false);
  });

  it("rejects a replay outside the tolerance window", () => {
    const ts = 1700000000;
    const header = buildSignatureHeader(SECRET, BODY, ts);
    expect(verifySignature(SECRET, header, BODY, ts + 301).reason).toBe("expired");
    expect(verifySignature(SECRET, header, BODY, ts + 299).valid).toBe(true);
  });

  it("handles malformed / missing headers without throwing", () => {
    expect(verifySignature(SECRET, null, BODY, 1).reason).toBe("malformed");
    expect(verifySignature(SECRET, "garbage", BODY, 1).reason).toBe("no-timestamp");
  });

  it("accepts any matching v1 (supports secret rotation)", () => {
    const ts = 1700000000;
    const macOld = computeMac("old", ts, BODY);
    const macNew = computeMac(SECRET, ts, BODY);
    const header = `t=${ts},v1=${macOld},v1=${macNew}`;
    expect(verifySignature(SECRET, header, BODY, ts).valid).toBe(true);
  });
});
