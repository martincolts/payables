import { randomUUID } from "node:crypto";
import type { DB } from "../db/client.js";
import { organizations, users } from "../db/schema/index.js";

/**
 * Repo-level test helper: inserts an organization and its admin owner directly,
 * returning the ids that org-scoped repo methods require. Repo tests exercise a
 * single repo in isolation, so they seed prerequisite rows straight through the
 * DB rather than going via other repos.
 */
export async function seedOrg(
  db: DB,
  overrides: { name?: string; requiredApprovals?: number } = {},
): Promise<{ organizationId: string; ownerId: string }> {
  const [org] = await db
    .insert(organizations)
    .values({
      name: overrides.name ?? `Org ${randomUUID().slice(0, 8)}`,
      ...(overrides.requiredApprovals !== undefined
        ? { requiredApprovals: overrides.requiredApprovals }
        : {}),
    })
    .returning();
  const [owner] = await db
    .insert(users)
    .values({
      organizationId: org!.id,
      name: "Owner",
      email: `owner-${randomUUID()}@example.com`,
      passwordHash: "scrypt$00$11",
      role: "admin",
      status: "active",
    })
    .returning();
  return { organizationId: org!.id, ownerId: owner!.id };
}
