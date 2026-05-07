import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function logAudit(params: {
  userId?: string;
  projectId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
}) {
  await db.insert(auditLog).values({
    userId: params.userId || null,
    projectId: params.projectId || null,
    action: params.action,
    resourceType: params.resourceType || null,
    resourceId: params.resourceId || null,
    details: params.details ? JSON.stringify(params.details) : null,
  });
}
