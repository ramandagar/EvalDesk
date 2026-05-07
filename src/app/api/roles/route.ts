import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users);
  return NextResponse.json(allUsers);
}

export async function PUT(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only owners/admins can change roles
  const [currentUser] = await db.select().from(users).where(eq(users.id, user.id));
  if (!currentUser || (currentUser.role !== "owner" && currentUser.role !== "admin")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, role } = body;
  if (!userId || !role) return NextResponse.json({ error: "userId and role required" }, { status: 400 });
  if (!["owner", "admin", "reviewer", "readonly"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent demoting yourself
  if (userId === user.id && role !== currentUser.role) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));
  return NextResponse.json({ success: true });
}
