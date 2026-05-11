import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { onboardingState } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [state] = await db.select().from(onboardingState).where(eq(onboardingState.userId, user.id)).limit(1);
    if (state) return NextResponse.json(state);
    return NextResponse.json({ currentStep: 1, isComplete: false });
  } catch {
    return NextResponse.json({ currentStep: 1, isComplete: false });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { currentStep, role, useCase, agentType, isComplete } = body;

    const existing = await db.select().from(onboardingState).where(eq(onboardingState.userId, user.id)).limit(1);

    const data = {
      userId: user.id,
      currentStep: currentStep ?? 1,
      role: role || null,
      useCase: useCase || null,
      agentType: agentType || null,
      isComplete: isComplete ?? false,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(onboardingState)
        .set(data)
        .where(eq(onboardingState.userId, user.id));
    } else {
      await db.insert(onboardingState).values(data);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save onboarding state" }, { status: 500 });
  }
}
