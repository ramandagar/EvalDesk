import { db } from "@/db";
import { subscriptions, plans } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getUserSubscription(userId: string) {
  try {
    const subs = await db.select({ subscription: subscriptions, plan: plans })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (subs.length > 0) return subs[0];

    // Default to free plan
    const [freePlan] = await db.select().from(plans).where(eq(plans.name, "Free")).limit(1);
    return { subscription: null, plan: freePlan || { id: "plan-free", name: "Free", price: 0, features: "[]", limits: '{"projects":5,"testCases":100}' } };
  } catch {
    return { subscription: null, plan: { id: "plan-free", name: "Free", price: 0, features: "[]", limits: '{"projects":5,"testCases":100}' } };
  }
}

export function getPlanLimits(planName: string) {
  const limits: Record<string, { projects: number; testCases: number; teamMembers: number }> = {
    Free: { projects: 5, testCases: 100, teamMembers: 1 },
    Pro: { projects: -1, testCases: -1, teamMembers: 10 },
    Enterprise: { projects: -1, testCases: -1, teamMembers: -1 },
  };
  return limits[planName] || limits.Free;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
