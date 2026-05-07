import crypto from "crypto";

const PREFIX = "evaldesk_live_";

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(24).toString("hex");
  const key = PREFIX + random;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 16); // evaldesk_live_ + first 4 hex chars
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function validateApiKey(key: string): Promise<{ valid: boolean; userId?: string; projectId?: string; permissions?: string[] }> {
  const { db } = await import("@/db");
  const { apiKeys } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const hash = hashApiKey(key);
  const [found] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash));

  if (!found) return { valid: false };
  if (found.expiresAt && new Date(found.expiresAt) < new Date()) return { valid: false };

  // Update last used
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, found.id));

  return {
    valid: true,
    userId: found.userId,
    projectId: found.projectId || undefined,
    permissions: JSON.parse(found.permissions || '["read"]'),
  };
}
