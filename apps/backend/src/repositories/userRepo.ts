import { eq } from "drizzle-orm";
import type { AuthUser, UserRole } from "@payables/shared";
import type { DB } from "../db/client.js";
import { users } from "../db/schema/index.js";
import { ConflictError, NotFoundError } from "../types/errors.js";

export type NewUser = {
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
};

/** A user row with its password hash — for credential checks only. */
export type UserWithHash = AuthUser & { passwordHash: string };

/** Consumer-side interface: the slice of user persistence services depend on. */
export type UserRepo = {
  create(input: NewUser): Promise<AuthUser>;
  getByEmail(email: string): Promise<UserWithHash | null>;
  getById(id: string): Promise<AuthUser>;
};

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
  };
}

/** Postgres unique-violation error code. */
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  // Drizzle wraps driver errors in a DrizzleQueryError, exposing the original
  // pg error (which carries the SQLSTATE `code`) on `.cause`.
  for (let cur: unknown = err; cur != null; cur = (cur as { cause?: unknown }).cause) {
    if (
      typeof cur === "object" &&
      "code" in cur &&
      (cur as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return true;
    }
  }
  return false;
}

export function createUserRepo(db: DB): UserRepo {
  return {
    async create(input) {
      try {
        const [row] = await db
          .insert(users)
          .values({
            name: input.name,
            email: input.email,
            passwordHash: input.passwordHash,
            role: input.role ?? "admin",
          })
          .returning();
        return toAuthUser(row!);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError("A user with that email already exists");
        }
        throw err;
      }
    },

    async getByEmail(email) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!row) return null;
      return { ...toAuthUser(row), passwordHash: row.passwordHash };
    },

    async getById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!row) throw new NotFoundError("User", id);
      return toAuthUser(row);
    },
  };
}
