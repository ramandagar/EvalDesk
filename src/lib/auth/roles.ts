// ============================================================================
// RBAC capability matrix. Roles are per-organization (memberships.role), not
// global. Capabilities are checked at the guard (default-deny): if a role isn't
// granted a capability here, it cannot perform it — enforced server-side, never
// just hidden in the UI.
// ============================================================================

export type Role = "owner" | "admin" | "reviewer" | "viewer";

export type Capability =
  | "org:read"
  | "org:manage"
  | "billing:manage"
  | "member:manage"
  | "project:read"
  | "project:write"
  | "run:read"
  | "run:execute"
  | "run:approve"
  | "result:rate"
  | "result:adjudicate"
  | "key:manage"
  | "webhook:manage";

export const ALL_CAPABILITIES: Capability[] = [
  "org:read",
  "org:manage",
  "billing:manage",
  "member:manage",
  "project:read",
  "project:write",
  "run:read",
  "run:execute",
  "run:approve",
  "result:rate",
  "result:adjudicate",
  "key:manage",
  "webhook:manage",
];

const VIEWER: Capability[] = ["org:read", "project:read", "run:read"];
const REVIEWER: Capability[] = [...VIEWER, "result:rate", "result:adjudicate"];
const ADMIN: Capability[] = [
  ...REVIEWER,
  "org:manage",
  "member:manage",
  "project:write",
  "run:execute",
  "run:approve",
  "key:manage",
  "webhook:manage",
];

const MATRIX: Record<Role, ReadonlySet<Capability>> = {
  owner: new Set(ALL_CAPABILITIES), // owner can do everything, incl. billing
  admin: new Set(ADMIN),
  reviewer: new Set(REVIEWER),
  viewer: new Set(VIEWER),
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role]?.has(capability) ?? false;
}

export function isRole(value: string): value is Role {
  return value === "owner" || value === "admin" || value === "reviewer" || value === "viewer";
}
