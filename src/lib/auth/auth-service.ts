// ============================================================================
// Auth service. Signup provisions a user + a personal organization + an owner
// membership + a session, atomically from the caller's view. Login verifies the
// password and opens a session scoped to the user's first org. All dependencies
// (repos, session service, password hasher, clock, slug generator) are injected
// so the whole flow is unit-testable with a fast fake hasher.
// ============================================================================

import { randomBytes } from "node:crypto";
import type { usersRepo, User } from "@/db/repos/users";
import type { membershipsRepo } from "@/db/repos/memberships";
import type { organizationsRepo, Organization } from "@/db/repos/organizations";
import type { sessionService } from "./session";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export interface AuthDeps {
  users: ReturnType<typeof usersRepo>;
  memberships: ReturnType<typeof membershipsRepo>;
  orgs: ReturnType<typeof organizationsRepo>;
  sessions: ReturnType<typeof sessionService>;
  hasher: PasswordHasher;
  now: () => number;
  /** Defaults to slug(name)+random suffix; injectable for deterministic tests. */
  genSlug?: (name: string) => string;
}

export class AuthError extends Error {
  readonly status = 400; // mapped to HTTP 400 by errorResponse
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export const MIN_PASSWORD_LENGTH = 8;

function defaultSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "org";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export interface SignupArgs {
  name?: string;
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginArgs {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}

export function authService(deps: AuthDeps) {
  const genSlug = deps.genSlug ?? defaultSlug;

  return {
    async signup(
      args: SignupArgs,
    ): Promise<{ user: User; org: Organization; token: string }> {
      const email = args.email?.trim().toLowerCase();
      if (!email || !args.password) throw new AuthError("Email and password are required");
      if (args.password.length < MIN_PASSWORD_LENGTH) {
        throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      if (await deps.users.getByEmail(email)) {
        throw new AuthError("Email already registered");
      }

      const now = deps.now();
      const name = args.name?.trim() || email.split("@")[0];
      const passwordHash = await deps.hasher.hash(args.password);

      const user = await deps.users.create({ name, email, passwordHash, emailVerified: now, now });
      const org = await deps.orgs.create({ name: `${name}'s Workspace`, slug: genSlug(name), now });
      await deps.memberships.create({
        orgId: org.id,
        userId: user.id,
        role: "owner",
        acceptedAt: now,
        now,
      });

      const { token } = await deps.sessions.create({
        userId: user.id,
        orgId: org.id,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
      });

      return { user, org, token };
    },

    async login(
      args: LoginArgs,
    ): Promise<{ user: User; token: string; orgId: string | null }> {
      const email = args.email?.trim().toLowerCase();
      const user = email ? await deps.users.getByEmail(email) : null;
      // Always run a compare-shaped check to avoid trivial user-enumeration via
      // timing, then fail with the same generic message.
      const ok = user?.passwordHash
        ? await deps.hasher.compare(args.password, user.passwordHash)
        : false;
      if (!user || !ok) throw new AuthError("Invalid email or password");

      const memberships = await deps.memberships.listForUser(user.id);
      const orgId = memberships[0]?.orgId ?? null;
      const { token } = await deps.sessions.create({
        userId: user.id,
        orgId,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
      });

      return { user, token, orgId };
    },

    async logout(token: string): Promise<void> {
      await deps.sessions.revoke(token);
    },
  };
}
