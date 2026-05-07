import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Helper: get current user or return null
// Most routes use: const user = await requireAuth(request); if (!user) return NextResponse.json({...}, {status: 401});
export async function requireAuth(req: NextRequest) {
  const user = await getCurrentUser();
  return user || null;
}
