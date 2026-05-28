import { eq } from "drizzle-orm";
import type {
  AuthUser,
  Organization,
  UpdateOrganizationInput,
} from "@payables/shared";
import type { DB } from "../db/client.js";
import { organizations, users } from "../db/schema/index.js";
import { ConflictError, NotFoundError } from "../types/errors.js";
import { isUniqueViolation } from "../lib/pgErrors.js";

export type NewOwner = {
  name: string;
  email: string;
  passwordHash: string;
};

/** Consumer-side interface: the slice of org persistence services depend on. */
export type OrganizationRepo = {
  /**
   * Creates an organization and its first admin (the owner) atomically — the
   * signup path. Returns both so the caller can mint a token.
   */
  createWithOwner(
    orgName: string,
    owner: NewOwner,
  ): Promise<{ organization: Organization; owner: AuthUser }>;
  getById(id: string): Promise<Organization>;
  update(id: string, patch: UpdateOrganizationInput): Promise<Organization>;
};

function toOrganization(row: typeof organizations.$inferSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    requiredApprovals: row.requiredApprovals,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createOrganizationRepo(db: DB): OrganizationRepo {
  return {
    async createWithOwner(orgName, owner) {
      try {
        return await db.transaction(async (tx) => {
          const [org] = await tx
            .insert(organizations)
            .values({ name: orgName })
            .returning();
          const [user] = await tx
            .insert(users)
            .values({
              organizationId: org!.id,
              name: owner.name,
              email: owner.email,
              passwordHash: owner.passwordHash,
              role: "admin",
              status: "active",
            })
            .returning();
          return {
            organization: toOrganization(org!),
            owner: {
              id: user!.id,
              organizationId: user!.organizationId,
              email: user!.email,
              name: user!.name,
              role: "admin" as const,
            },
          };
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError("A user with that email already exists");
        }
        throw err;
      }
    },

    async getById(id) {
      const [row] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);
      if (!row) throw new NotFoundError("Organization", id);
      return toOrganization(row);
    },

    async update(id, patch) {
      const [row] = await db
        .update(organizations)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.requiredApprovals !== undefined
            ? { requiredApprovals: patch.requiredApprovals }
            : {}),
        })
        .where(eq(organizations.id, id))
        .returning();
      if (!row) throw new NotFoundError("Organization", id);
      return toOrganization(row);
    },
  };
}
