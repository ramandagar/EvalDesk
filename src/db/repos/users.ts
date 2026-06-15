import { eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  emailVerified: number | null;
  image: string | null;
  createdAt: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  now: number;
  passwordHash?: string | null;
  emailVerified?: number | null;
  id?: string;
}

export function usersRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.users;

  return {
    async create(input: CreateUserInput): Promise<User> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash ?? null,
          emailVerified: input.emailVerified ?? null,
          createdAt: input.now,
        })
        .returning();
      return row as User;
    },

    async getById(id: string): Promise<User | null> {
      const [row] = await db.select().from(t).where(eq(t.id, id));
      return (row as User) ?? null;
    },

    async getByEmail(email: string): Promise<User | null> {
      const [row] = await db.select().from(t).where(eq(t.email, email));
      return (row as User) ?? null;
    },

    async updatePassword(id: string, passwordHash: string): Promise<void> {
      await db.update(t).set({ passwordHash }).where(eq(t.id, id));
    },
  };
}
