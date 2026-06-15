// ============================================================================
// RFC 8785 JSON Canonicalization Scheme (JCS) — PURE, zero IO. Moat feature #4
// foundation: the bytes a certificate is signed over MUST be reproducible
// byte-for-byte on both SQLite and Postgres, across Node versions, and by a
// third-party verifier — so we canonicalize deterministically rather than
// trusting JSON.stringify key order.
//
// Rules (RFC 8785):
//  * Object members sorted by the UTF-16 code units of their keys.
//  * No insignificant whitespace.
//  * Strings escaped minimally (",\, control chars; short escapes for \b\t\n\f\r;
//    everything else, including non-ASCII, emitted as raw UTF-8).
//  * Numbers serialized per ECMAScript Number::toString — which JavaScript's
//    String(n) already implements — with -0 normalized to "0".
//  * `undefined` members are dropped (callers also omit nulls in the payload).
// ============================================================================

const ESCAPES: Record<string, string> = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
};

function serializeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ESCAPES[ch]) out += ESCAPES[ch];
    else if (code < 0x20) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch; // raw UTF-8, including non-ASCII (RFC 8785)
  }
  return out + '"';
}

function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`cannot canonicalize non-finite number: ${n}`);
  if (n === 0) return "0"; // normalize -0 → "0"
  // ECMAScript Number::toString is exactly what RFC 8785 mandates; String(n) is it.
  return String(n);
}

/** Canonicalize a JSON value to its RFC 8785 string form. */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") return serializeNumber(value as number);
  if (t === "bigint") return (value as bigint).toString();
  if (t === "string") return serializeString(value as string);

  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalize(v === undefined ? null : v)).join(",") + "]";
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(); // JS string sort == UTF-16 code-unit order (RFC 8785)
    const members = keys.map((k) => serializeString(k) + ":" + canonicalize(obj[k]));
    return "{" + members.join(",") + "}";
  }

  throw new Error(`cannot canonicalize value of type ${t}`);
}

/** Canonical bytes (UTF-8) — what you hash/sign. */
export function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), "utf8");
}
