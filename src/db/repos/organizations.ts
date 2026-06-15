import { eq } from "drizzle-orm";
import type { DbHandle, AppSchema } from "../client";

// Domain type — the dialect-agnostic public shape repos return. App code stays
// fully typed against this; the DbHandle erasure never leaks past the repo.
export interface Organization {
  id: string;
  name: string;
  slug: string;
  planId: string | null;
  signingKeyId: string | null;
  createdAt: number;
  archivedAt: number | null;
}

export interface CreateOrgInput {
  name: string;
  slug: string;
  now: number; // injected clock (epoch-ms) — never Date.now() inside repos
  id?: string;
}

/**
 * Organizations repository. All org persistence goes through here; routes and
 * the worker never touch the schema table directly.
 */
export function organizationsRepo(db: DbHandle, schema: AppSchema) {
  const t = schema.organizations;

  return {
    async create(input: CreateOrgInput): Promise<Organization> {
      const [row] = await db
        .insert(t)
        .values({
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          slug: input.slug,
          createdAt: input.now,
        })
        .returning();
      return row as Organization;
    },

    async getById(id: string): Promise<Organization | null> {
      const [row] = await db.select().from(t).where(eq(t.id, id));
      return (row as Organization) ?? null;
    },

    async getBySlug(slug: string): Promise<Organization | null> {
      const [row] = await db.select().from(t).where(eq(t.slug, slug));
      return (row as Organization) ?? null;
    },

    async list(): Promise<Organization[]> {
      const rows = await db.select().from(t).orderBy(t.createdAt);
      return rows as Organization[];
    },
  };
}
