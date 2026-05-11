import { NextRequest, NextResponse } from "next/server";
import { signup, login } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/db";
import { onboardingState } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, password, action } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    let result;
    if (action === "signup") {
      result = await signup(email, name || "", password);
    } else {
      result = await login(email, password);
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const user = result.user!;
    if (!user) return NextResponse.json({ error: "Auth failed" }, { status: 500 });
    const cookieStore = await cookies();
    cookieStore.set("evaldesk_user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Check onboarding state
    let needsOnboarding = false;
    try {
      const [state] = await db.select().from(onboardingState).where(eq(onboardingState.userId, user.id)).limit(1);
      needsOnboarding = !state || !state.isComplete;
    } catch {}

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email }, isFirstUser: action === "signup", needsOnboarding });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
