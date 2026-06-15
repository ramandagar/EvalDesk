import { describe, it, expect } from "vitest";
import { isBlockedIp, assertAllowedUrl, guardedFetch, SSRFError, type SafeFetchDeps } from "@/lib/net/ssrf";

describe("isBlockedIp — attack corpus", () => {
  const blocked = [
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "10.0.0.5",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "169.254.0.1",
    "100.64.0.1", // CGNAT
    "198.18.0.5",
    "224.0.0.1", // multicast
    "255.255.255.255",
    "::1", // IPv6 loopback
    "fc00::1", // unique-local
    "fd12:3456::1",
    "fe80::1", // link-local
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "::ffff:10.0.0.1", // IPv4-mapped private
    "not-an-ip", // fail closed
  ];
  for (const ip of blocked) {
    it(`blocks ${ip}`, () => expect(isBlockedIp(ip)).toBe(true));
  }

  const allowed = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "192.169.0.1", "2606:4700:4700::1111"];
  for (const ip of allowed) {
    it(`allows public ${ip}`, () => expect(isBlockedIp(ip)).toBe(false));
  }
});

describe("assertAllowedUrl", () => {
  it("accepts http/https", () => {
    expect(assertAllowedUrl("https://api.example.com/x").hostname).toBe("api.example.com");
    expect(assertAllowedUrl("http://example.com").protocol).toBe("http:");
  });
  it("rejects non-http schemes", () => {
    expect(() => assertAllowedUrl("file:///etc/passwd")).toThrow(SSRFError);
    expect(() => assertAllowedUrl("gopher://x")).toThrow(SSRFError);
    expect(() => assertAllowedUrl("ftp://x")).toThrow(SSRFError);
  });
  it("rejects embedded credentials", () => {
    expect(() => assertAllowedUrl("http://user:pass@internal/")).toThrow(/credentials/);
  });
});

describe("guardedFetch", () => {
  function deps(resolved: string[], onFetch?: (u: string) => void): SafeFetchDeps {
    return {
      resolve: async () => resolved,
      fetchImpl: (async (u: string) => {
        onFetch?.(u);
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch,
    };
  }

  it("blocks when the host resolves to a private address (DNS-rebind defense)", async () => {
    await expect(guardedFetch(deps(["10.0.0.5"]), "https://evil.example.com")).rejects.toThrow(
      SSRFError,
    );
  });

  it("blocks when ANY resolved address is private (split-horizon)", async () => {
    await expect(
      guardedFetch(deps(["8.8.8.8", "169.254.169.254"]), "https://evil.example.com"),
    ).rejects.toThrow(SSRFError);
  });

  it("blocks an IP-literal loopback URL without resolving", async () => {
    await expect(guardedFetch(deps([]), "http://127.0.0.1:8080/admin")).rejects.toThrow(SSRFError);
    await expect(guardedFetch(deps([]), "http://[::1]/")).rejects.toThrow(SSRFError);
  });

  it("throws when the host does not resolve", async () => {
    await expect(guardedFetch(deps([]), "https://nxdomain.example.com")).rejects.toThrow(/resolve/);
  });

  it("allows and fetches a public host", async () => {
    let called = "";
    const res = await guardedFetch(deps(["93.184.216.34"], (u) => (called = u)), "https://example.com/api");
    expect(res.status).toBe(200);
    expect(called).toBe("https://example.com/api");
  });
});
