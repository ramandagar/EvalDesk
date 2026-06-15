// ============================================================================
// SSRF guard. The agent runner and webhook delivery call user-supplied URLs
// server-side, so they must be prevented from reaching internal/loopback/
// link-local/cloud-metadata addresses.
//
// Strategy: validate the URL (http/https only, no credentials), resolve the
// hostname to IP(s), and BLOCK if any resolved address is private/reserved.
// `isBlockedIp` is the pure heart, verified against an attack corpus including
// loopback, RFC1918, CGNAT, link-local (incl. 169.254.169.254 metadata),
// IPv6 ULA/link-local, and IPv4-mapped IPv6. Fail-closed: anything we can't
// parse is treated as blocked.
//
// Production wiring (safe-fetch.ts) injects a real DNS resolver; tests inject a
// fake resolver so no real network/DNS is touched.
// ============================================================================

import { isIP } from "node:net";

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n >>> 0;
}

function inRange(n: number, baseIp: string, bits: number): boolean {
  const base = ipv4ToInt(baseIp);
  if (base === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((n & mask) >>> 0) === ((base & mask) >>> 0);
}

// CIDR blocks that must never be reachable.
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local incl. 169.254.169.254 metadata
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + 255.255.255.255 broadcast
];

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → fail closed
  return BLOCKED_V4.some(([base, bits]) => inRange(n, base, bits));
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified

  // IPv4-mapped (::ffff:a.b.c.d) — defer to the v4 rules.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);

  const firstHextet = parseInt(lower.split(":")[0] || "0", 16);
  if (Number.isNaN(firstHextet)) return true;
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/** True if an IP literal is private/reserved and must be blocked. */
export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP → fail closed
}

/** Validate scheme + forbid credentials; returns the parsed URL. */
export function assertAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SSRFError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SSRFError(`Unsupported scheme: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new SSRFError("URL must not contain credentials");
  }
  if (!url.hostname) throw new SSRFError("URL must have a host");
  return url;
}

export interface SafeFetchDeps {
  /** Resolve a hostname to one or more IP addresses. */
  resolve: (hostname: string) => Promise<string[]>;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch a URL only if it is public. Validates the URL, resolves the host, and
 * blocks if any resolved address is private/reserved.
 */
export async function guardedFetch(
  deps: SafeFetchDeps,
  raw: string,
  init?: RequestInit,
): Promise<Response> {
  const url = assertAllowedUrl(raw);

  let addresses: string[];
  if (isIP(url.hostname)) {
    addresses = [url.hostname];
  } else if (isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    addresses = [url.hostname.replace(/^\[|\]$/g, "")];
  } else {
    addresses = await deps.resolve(url.hostname);
    if (!addresses.length) throw new SSRFError("Host did not resolve");
  }

  for (const addr of addresses) {
    if (isBlockedIp(addr)) throw new SSRFError(`Blocked address ${addr} for host ${url.hostname}`);
  }

  const doFetch = deps.fetchImpl ?? fetch;
  return doFetch(raw, init);
}
