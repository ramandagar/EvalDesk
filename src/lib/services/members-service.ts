// ============================================================================
// Members service — team management. Listing is any member (org:read); adding /
// role changes / removal require member:manage (owner/admin). Adding is "by
// email": the person must already have an EvalDesk account (full email-invite
// flow lands with the email integration). Guards against removing or demoting
// the last owner so an org can never be orphaned.
// ============================================================================

import type { guard } from "@/lib/auth/guard";
import { AuthzError } from "@/lib/auth/guard";
import { isRole, type Role } from "@/lib/auth/roles";
import type { membershipsRepo } from "@/db/repos/memberships";
import type { usersRepo } from "@/db/repos/users";

export interface MembersServiceDeps {
  guard: ReturnType<typeof guard>;
  memberships: ReturnType<typeof membershipsRepo>;
  users: ReturnType<typeof usersRepo>;
  now: () => number;
}

export interface Member {
  userId: string;
  email: string;
  name: string;
  role: Role;
  isYou: boolean;
}

export function membersService(deps: MembersServiceDeps) {
  async function ownerCount(orgId: string): Promise<number> {
    return (await deps.memberships.listForOrg(orgId)).filter((m) => m.role === "owner").length;
  }

  return {
    async list(token: string | undefined, orgId: string): Promise<Member[]> {
      const ctx = await deps.guard.requireMember(token, orgId, "org:read");
      const memberships = await deps.memberships.listForOrg(orgId);
      const members = await Promise.all(
        memberships.map(async (m) => {
          const u = await deps.users.getById(m.userId);
          return { userId: m.userId, email: u?.email ?? "", name: u?.name ?? "", role: m.role as Role, isYou: m.userId === ctx.user.id };
        }),
      );
      return members.sort((a, b) => a.email.localeCompare(b.email));
    },

    async addByEmail(token: string | undefined, orgId: string, args: { email: string; role: Role }): Promise<Member> {
      await deps.guard.requireMember(token, orgId, "member:manage");
      if (!isRole(args.role) || args.role === "owner") {
        throw new AuthzError(400, "Pick a role: admin, reviewer, or viewer");
      }
      const user = await deps.users.getByEmail(args.email.trim().toLowerCase());
      if (!user) throw new AuthzError(404, "No EvalDesk account with that email — ask them to sign up first");
      if (await deps.memberships.get(orgId, user.id)) throw new AuthzError(409, "Already a member");

      await deps.memberships.create({ orgId, userId: user.id, role: args.role, acceptedAt: deps.now(), now: deps.now() });
      return { userId: user.id, email: user.email, name: user.name, role: args.role, isYou: false };
    },

    async updateRole(token: string | undefined, orgId: string, userId: string, role: Role): Promise<void> {
      await deps.guard.requireMember(token, orgId, "member:manage");
      if (!isRole(role)) throw new AuthzError(400, "Invalid role");
      const current = await deps.memberships.get(orgId, userId);
      if (!current) throw new AuthzError(404, "Not found");
      // Don't allow demoting the last owner.
      if (current.role === "owner" && role !== "owner" && (await ownerCount(orgId)) <= 1) {
        throw new AuthzError(400, "An organization must have at least one owner");
      }
      await deps.memberships.updateRole(orgId, userId, role);
    },

    async remove(token: string | undefined, orgId: string, userId: string): Promise<void> {
      await deps.guard.requireMember(token, orgId, "member:manage");
      const current = await deps.memberships.get(orgId, userId);
      if (!current) throw new AuthzError(404, "Not found");
      if (current.role === "owner" && (await ownerCount(orgId)) <= 1) {
        throw new AuthzError(400, "Can't remove the last owner");
      }
      await deps.memberships.remove(orgId, userId);
    },
  };
}
