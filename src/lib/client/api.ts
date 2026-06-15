"use client";

// Tiny browser API client for the secure /api/v1 surface. Resolves the active
// org once via /me (redirecting to /login on 401), then injects x-org-id +
// credentials on every call. One place so every page calls the API the same way.

let _org: string | null = null;
let _email: string | null = null;

export interface Me {
  user: { id: string; email: string };
  activeOrgId: string | null;
  orgs: Array<{ id: string; name: string; slug: string; role: string }>;
}

export async function getMe(): Promise<Me> {
  const res = await fetch("/api/v1/me", { credentials: "include" });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Not authenticated");
  }
  const me = (await res.json()) as Me;
  _org = me.activeOrgId ?? me.orgs?.[0]?.id ?? null;
  _email = me.user?.email ?? null;
  return me;
}

export function cachedEmail(): string | null {
  return _email;
}

async function org(): Promise<string> {
  if (_org) return _org;
  await getMe();
  if (!_org) throw new Error("No organization for this account");
  return _org;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const orgId = await org();
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json", "x-org-id": orgId },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export const api = {
  get: <T>(path: string) => req<T>("GET", path),
  post: <T>(path: string, body?: unknown) => req<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => req<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => req<T>("PATCH", path, body),
  del: <T>(path: string) => req<T>("DELETE", path),
};

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  _org = null;
  _email = null;
  if (typeof window !== "undefined") window.location.href = "/login";
}

// Shared types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  agentEndpoint: string | null;
  hasAgentApiKey?: boolean;
}
export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  input: string;
  expectedOutput: string | null;
}
export interface Run {
  id: string;
  projectId: string;
  status: string;
  totalCases: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  unratedCount: number;
  passRate: number | null;
  createdAt: number;
}
