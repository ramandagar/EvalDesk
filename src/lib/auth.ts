import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "./utils";
import bcrypt from "bcryptjs";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("evaldesk_user_id")?.value;
  if (!userId) return null;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || null;
  } catch {
    return null;
  }
}

export async function signup(email: string, name: string, password: string) {
  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return { error: "Email already registered" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = createId();
  await db.insert(users).values({ id, email, name: name || email.split("@")[0], passwordHash, emailVerified: new Date() });

  const [user] = await db.select().from(users).where(eq(users.email, email));
  return { user };
}

export async function login(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return { error: "Invalid email or password" };
  }

  if (!user.passwordHash) {
    return { error: "Please set up a password for your account" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  return { user };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("evaldesk_user_id");
}

// Keep for backwards compat
export async function loginOrCreate(email: string, name: string) {
  let [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    const id = createId();
    await db.insert(users).values({ id, email, name: name || email.split("@")[0], emailVerified: new Date() });
    [user] = await db.select().from(users).where(eq(users.email, email));
  }
  return user;
}
