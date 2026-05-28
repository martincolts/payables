import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createActivityLogRepo,
  type ActivityLogRepo,
} from "./activityLogRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";
import { seedOrg } from "../test/repoHelpers.js";

describe("activityLogRepo", () => {
  let testDb: TestDb;
  let repo: ActivityLogRepo;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createActivityLogRepo(testDb.db);
    ({ organizationId: orgId, ownerId: userId } = await seedOrg(testDb.db));
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("log", () => {
    it("persists an entry with metadata", async () => {
      const entityId = randomUUID();
      await repo.log({
        organizationId: orgId,
        userId,
        action: "vendor_created",
        entityType: "vendor",
        entityId,
        metadata: { name: "Acme" },
      });

      const { items } = await repo.list({
        organizationId: orgId,
        page: 1,
        pageSize: 100,
      });
      const entry = items.find((e) => e.entityId === entityId);
      expect(entry).toBeDefined();
      expect(entry!.action).toBe("vendor_created");
      expect(entry!.entityType).toBe("vendor");
      expect(entry!.userId).toBe(userId);
      expect(entry!.userName).toBe("Owner");
      expect(entry!.metadata).toEqual({ name: "Acme" });
      expect(typeof entry!.createdAt).toBe("string");
    });

    it("accepts null metadata", async () => {
      const entityId = randomUUID();
      await repo.log({
        organizationId: orgId,
        userId,
        action: "bill_deleted",
        entityType: "bill",
        entityId,
      });
      const { items } = await repo.list({
        organizationId: orgId,
        page: 1,
        pageSize: 100,
        action: "bill_deleted",
      });
      expect(items.some((e) => e.entityId === entityId && e.metadata === null)).toBe(
        true,
      );
    });
  });

  describe("list", () => {
    // Use a dedicated org so we control exactly which rows the list sees.
    let listOrg: string;
    let alice: string;
    let bob: string;

    beforeAll(async () => {
      const seed = await seedOrg(testDb.db);
      listOrg = seed.organizationId;
      alice = seed.ownerId;

      // A second user in the same org so we can exercise the userId filter.
      const [bobRow] = await testDb.db
        .insert((await import("../db/schema/index.js")).users)
        .values({
          organizationId: listOrg,
          name: "Bob",
          email: `bob-${randomUUID()}@example.com`,
          passwordHash: "scrypt$00$11",
          role: "admin",
          status: "active",
        })
        .returning();
      bob = bobRow!.id;

      // Seed a known sequence of entries.
      await repo.log({
        organizationId: listOrg,
        userId: alice,
        action: "bill_created",
        entityType: "bill",
        entityId: randomUUID(),
      });
      await repo.log({
        organizationId: listOrg,
        userId: bob,
        action: "vendor_created",
        entityType: "vendor",
        entityId: randomUUID(),
      });
      await repo.log({
        organizationId: listOrg,
        userId: alice,
        action: "vendor_deactivated",
        entityType: "vendor",
        entityId: randomUUID(),
      });
    });

    it("orders newest-first and reports the total", async () => {
      const { items, total } = await repo.list({
        organizationId: listOrg,
        page: 1,
        pageSize: 100,
      });
      expect(total).toBe(3);
      const times = items.map((e) => new Date(e.createdAt).getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it("filters by user", async () => {
      const { items, total } = await repo.list({
        organizationId: listOrg,
        page: 1,
        pageSize: 100,
        userId: alice,
      });
      expect(total).toBe(2);
      expect(items.every((e) => e.userId === alice)).toBe(true);
    });

    it("filters by action", async () => {
      const { items, total } = await repo.list({
        organizationId: listOrg,
        page: 1,
        pageSize: 100,
        action: "vendor_created",
      });
      expect(total).toBe(1);
      expect(items[0]!.action).toBe("vendor_created");
      expect(items[0]!.userId).toBe(bob);
    });

    it("scopes to the given org", async () => {
      const { items } = await repo.list({
        organizationId: orgId,
        page: 1,
        pageSize: 100,
      });
      expect(items.every((e) => e.userName !== "Bob")).toBe(true);
    });

    it("paginates", async () => {
      const first = await repo.list({
        organizationId: listOrg,
        page: 1,
        pageSize: 2,
      });
      const second = await repo.list({
        organizationId: listOrg,
        page: 2,
        pageSize: 2,
      });
      expect(first.items).toHaveLength(2);
      expect(second.items).toHaveLength(1);
      expect(first.total).toBe(3);
    });
  });
});
