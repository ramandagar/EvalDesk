import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Helper: get current user or return 401
export async function requireAuth(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }), user: null };
  }
  return { error: null, user };
}
