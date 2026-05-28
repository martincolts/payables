import { asc, eq, sql } from "drizzle-orm";
import type {
  AuthUser,
  Member,
  PaginationQuery,
  UserRole,
  UserStatus,
} from "@payables/shared";
import type { DB } from "../db/client.js";
import { users } from "../db/schema/index.js";
import { ConflictError, NotFoundError } from "../types/errors.js";
import { isUniqueViolation } from "../lib/pgErrors.js";

export type NewPendingUser = {
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
};

/** A user row with its (possibly null) password hash — for credential checks. */
export type UserWithHash = AuthUser & {
  passwordHash: string | null;
  status: UserStatus;
};

/** Consumer-side interface: the slice of user persistence services depend on. */
export type UserRepo = {
  /** Creates a pending (no-password) member for an invitation. */
  createPending(input: NewPendingUser): Promise<Member>;
  /** Activates a pending user: sets their password and flips status to active. */
  activate(id: string, passwordHash: string): Promise<AuthUser>;
  getByEmail(email: string): Promise<UserWithHash | null>;
  getById(id: string): Promise<AuthUser>;
  list(
    organizationId: string,
    params: PaginationQuery,
  ): Promise<{ items: Member[]; total: number }>;
};

type UserRow = typeof users.$inferSelect;

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
  };
}

function toMember(row: UserRow): Member {
  return {
    ...toAuthUser(row),
    status: row.status as UserStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createUserRepo(db: DB): UserRepo {
  return {
    async createPending(input) {
      try {
        const [row] = await db
          .insert(users)
          .values({
            organizationId: input.organizationId,
            name: input.name,
            email: input.email,
            passwordHash: null,
            role: input.role,
            status: "pending",
          })
          .returning();
        return toMember(row!);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError("A user with that email already exists");
        }
        throw err;
      }
    },

    async activate(id, passwordHash) {
      const [row] = await db
        .update(users)
        .set({ passwordHash, status: "active" })
        .where(eq(users.id, id))
        .returning();
      if (!row) throw new NotFoundError("User", id);
      return toAuthUser(row);
    },

    async getByEmail(email) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!row) return null;
      return {
        ...toAuthUser(row),
        passwordHash: row.passwordHash,
        status: row.status as UserStatus,
      };
    },

    async getById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!row) throw new NotFoundError("User", id);
      return toAuthUser(row);
    },

    async list(organizationId, { page, pageSize }) {
      const offset = (page - 1) * pageSize;
      const where = eq(users.organizationId, organizationId);
      const [rows, [{ count } = { count: 0 }]] = await Promise.all([
        db
          .select()
          .from(users)
          .where(where)
          .orderBy(asc(users.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
      ]);
      return { items: rows.map(toMember), total: count };
    },
  };
}
