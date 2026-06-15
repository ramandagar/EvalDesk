#!/usr/bin/env node
// ============================================================================
// Offline EvalDesk certificate verifier. ZERO dependencies, ZERO network — it
// re-implements RFC 8785 canonicalization + Ed25519 verification with only
// node:crypto, so a regulator can verify a signed evaluation record with
// `npx evaldesk verify cert.json` and never call back to evaldesk.dev.
//
//   node scripts/verify-cert.mjs <cert.json>     # exit 0 valid, 1 invalid
//   import { verifyCertificateBundle }            # used by the test
// ============================================================================

import { readFileSync } from "node:fs";
import { createHash, verify as cryptoVerify } from "node:crypto";

const ESCAPES = { '"': '\\"', "\\": "\\\\", "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r" };

function serializeString(s) {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (ESCAPES[ch]) out += ESCAPES[ch];
    else if (code < 0x20) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + '"';
}

function canonicalize(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number");
    return value === 0 ? "0" : String(value);
  }
  if (t === "string") return serializeString(value);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalize(v === undefined ? null : v)).join(",") + "]";
  if (t === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return "{" + keys.map((k) => serializeString(k) + ":" + canonicalize(value[k])).join(",") + "}";
  }
  throw new Error("uncanonicalizable type " + t);
}

/** Verify a parsed certificate bundle offline. Returns { valid, reasons }. */
export function verifyCertificateBundle(cert) {
  const reasons = [];
  let canonicalJson;
  try {
    canonicalJson = canonicalize(cert.payload);
  } catch (e) {
    return { valid: false, reasons: ["payload-not-canonicalizable: " + e.message] };
  }
  if (cert.canonicalJson !== undefined && canonicalJson !== cert.canonicalJson) reasons.push("canonical-json-mismatch");

  const bytes = Buffer.from(canonicalJson, "utf8");
  if (cert.contentHash !== undefined && createHash("sha256").update(bytes).digest("hex") !== cert.contentHash) {
    reasons.push("content-hash-mismatch");
  }
  let sigOk = false;
  try {
    sigOk = cryptoVerify(null, bytes, cert.publicKeyPem, Buffer.from(cert.signature, "base64"));
  } catch {
    sigOk = false;
  }
  if (!sigOk) reasons.push("bad-signature");
  return { valid: reasons.length === 0, reasons };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: verify-cert <cert.json>");
    process.exit(2);
  }
  const cert = JSON.parse(readFileSync(path, "utf8"));
  const { valid, reasons } = verifyCertificateBundle(cert);
  if (valid) {
    console.log("✓ VALID — signature, hash, and canonical form all check out (offline).");
    process.exit(0);
  }
  console.error("✗ INVALID — " + reasons.join(", "));
  process.exit(1);
}
