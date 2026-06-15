// Composition helper: production safe fetch backed by the system DNS resolver.
// Numeric/encoded hosts (e.g. "2130706433", "0x7f000001") are normalized by
// dns.lookup to their real address and then blocked by the guard.
import { promises as dns } from "node:dns";
import { guardedFetch, type SafeFetchDeps } from "./ssrf";

const deps: SafeFetchDeps = {
  resolve: async (hostname) => {
    const records = await dns.lookup(hostname, { all: true });
    return records.map((r) => r.address);
  },
};

export function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  return guardedFetch(deps, url, init);
}
