import { desc, eq, sql } from "drizzle-orm";
import type { Invitation, PaginationQuery, UserRole } from "@payables/shared";
import type { DB } from "../db/client.js";
import { invitations, organizations, users } from "../db/schema/index.js";
import { ConflictError } from "../types/errors.js";
import { isUniqueViolation } from "../lib/pgErrors.js";

export type NewInvitation = {
  organizationId: string;
  userId: string;
  email: string;
  role: UserRole;
  token: string;
  invitedBy: string;
};

/** An invitation joined with the pending user's name and the org's name. */
export type InvitationDetail = Invitation & {
  userId: string;
  userName: string;
  organizationName: string;
};

/** Consumer-side interface: the slice of invitation persistence services depend on. */
export type InvitationRepo = {
  create(input: NewInvitation): Promise<Invitation>;
  getByToken(token: string): Promise<InvitationDetail | null>;
  markAccepted(id: string): Promise<void>;
  list(
    organizationId: string,
    params: PaginationQuery,
  ): Promise<{ items: Invitation[]; total: number }>;
};

function toInvitation(row: typeof invitations.$inferSelect): Invitation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    role: row.role as UserRole,
    status: row.status,
    token: row.token,
    createdAt: row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
  };
}

export function createInvitationRepo(db: DB): InvitationRepo {
  return {
    async create(input) {
      try {
        const [row] = await db
          .insert(invitations)
          .values({
            organizationId: input.organizationId,
            userId: input.userId,
            email: input.email,
            role: input.role,
            token: input.token,
            invitedBy: input.invitedBy,
          })
          .returning();
        return toInvitation(row!);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError("That email has already been invited");
        }
        throw err;
      }
    },

    async getByToken(token) {
      const [row] = await db
        .select({
          invitation: invitations,
          userName: users.name,
          organizationName: organizations.name,
        })
        .from(invitations)
        .innerJoin(users, eq(invitations.userId, users.id))
        .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
        .where(eq(invitations.token, token))
        .limit(1);
      if (!row) return null;
      return {
        ...toInvitation(row.invitation),
        userId: row.invitation.userId,
        userName: row.userName,
        organizationName: row.organizationName,
      };
    },

    async markAccepted(id) {
      await db
        .update(invitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(invitations.id, id));
    },

    async list(organizationId, { page, pageSize }) {
      const offset = (page - 1) * pageSize;
      const where = eq(invitations.organizationId, organizationId);
      const [rows, [{ count } = { count: 0 }]] = await Promise.all([
        db
          .select()
          .from(invitations)
          .where(where)
          .orderBy(desc(invitations.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(invitations).where(where),
      ]);
      return { items: rows.map(toInvitation), total: count };
    },
  };
}
