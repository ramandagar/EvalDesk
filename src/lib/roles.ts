const ROLE_HIERARCHY: Record<string, string[]> = {
  owner: ["read", "write", "admin", "delete", "manage_team"],
  admin: ["read", "write", "admin", "delete"],
  reviewer: ["read", "write", "rate"],
  readonly: ["read"],
};

export function canRead(role: string): boolean {
  return ROLE_HIERARCHY[role]?.includes("read") ?? false;
}

export function canWrite(role: string): boolean {
  return ROLE_HIERARCHY[role]?.includes("write") ?? false;
}

export function canAdmin(role: string): boolean {
  return ROLE_HIERARCHY[role]?.includes("admin") ?? false;
}

export function canApprove(role: string): boolean {
  return ROLE_HIERARCHY[role]?.includes("admin") ?? false;
}

export function canDelete(role: string): boolean {
  return ROLE_HIERARCHY[role]?.includes("delete") ?? false;
}
