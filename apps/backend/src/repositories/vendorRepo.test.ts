import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError } from "../types/errors.js";
import { createVendorRepo, type VendorRepo } from "./vendorRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";
import { seedOrg } from "../test/repoHelpers.js";

describe("vendorRepo", () => {
  let testDb: TestDb;
  let repo: VendorRepo;
  let orgId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createVendorRepo(testDb.db);
    ({ organizationId: orgId } = await seedOrg(testDb.db));
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("create", () => {
    it("inserts a vendor with bank details", async () => {
      const vendor = await repo.create(
        {
          name: "Stripe",
          email: "billing@stripe.com",
          paymentMethod: "wire",
          bankLast4: "5678",
        },
        orgId,
      );

      expect(vendor.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(vendor.name).toBe("Stripe");
      expect(vendor.email).toBe("billing@stripe.com");
      expect(vendor.paymentMethod).toBe("wire");
      expect(vendor.bankLast4).toBe("5678");
      expect(vendor.isActive).toBe(true);
      expect(typeof vendor.createdAt).toBe("string");
    });

    it("defaults bankLast4 to null when omitted", async () => {
      const vendor = await repo.create(
        { name: "Figma", email: "ap@figma.com", paymentMethod: "ach" },
        orgId,
      );
      expect(vendor.bankLast4).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns the vendor when it exists", async () => {
      const created = await repo.create(
        { name: "Notion", email: "ap@notion.so", paymentMethod: "ach", bankLast4: "4321" },
        orgId,
      );

      const found = await repo.getById(created.id, orgId);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe("Notion");
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.getById("00000000-0000-0000-0000-000000000000", orgId),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("does not return a vendor that belongs to another org", async () => {
      const { organizationId: otherOrg } = await seedOrg(testDb.db);
      const mine = await repo.create(
        { name: "Mine", email: "mine@v.com", paymentMethod: "ach" },
        orgId,
      );
      await expect(repo.getById(mine.id, otherOrg)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("list", () => {
    // Isolate listing to a fresh org so we control exactly what it sees.
    let listOrg: string;
    beforeAll(async () => {
      ({ organizationId: listOrg } = await seedOrg(testDb.db));
      for (const name of ["Zeta", "Alpha", "Mu", "Beta"]) {
        await repo.create({ name, email: `${name}@v.com`, paymentMethod: "check" }, listOrg);
      }
    });

    it("orders by name and reports the total", async () => {
      const { items, total } = await repo.list(listOrg, { page: 1, pageSize: 100 });
      expect(items).toHaveLength(4);
      expect(total).toBe(4);
      const names = items.map((v) => v.name);
      expect(names).toEqual([...names].sort());
    });

    it("paginates without exposing an offset", async () => {
      const { items: all } = await repo.list(listOrg, { page: 1, pageSize: 100 });
      const firstPage = await repo.list(listOrg, { page: 1, pageSize: 2 });
      const secondPage = await repo.list(listOrg, { page: 2, pageSize: 2 });

      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.total).toBe(all.length);
      expect(secondPage.total).toBe(all.length);
      expect(secondPage.items[0]!.id).toBe(all[2]!.id);
    });

    it("only lists vendors from the given org", async () => {
      const { organizationId: otherOrg } = await seedOrg(testDb.db);
      await repo.create({ name: "Outsider", email: "out@v.com", paymentMethod: "ach" }, otherOrg);
      const { items } = await repo.list(listOrg, { page: 1, pageSize: 100 });
      expect(items.some((v) => v.name === "Outsider")).toBe(false);
    });
  });

  describe("deactivate", () => {
    it("marks the vendor inactive and hides it from the list", async () => {
      const { organizationId: org } = await seedOrg(testDb.db);
      const vendor = await repo.create(
        { name: "Soon Gone", email: "bye@v.com", paymentMethod: "ach" },
        org,
      );

      const before = await repo.list(org, { page: 1, pageSize: 100 });
      expect(before.items.some((v) => v.id === vendor.id)).toBe(true);

      const deactivated = await repo.deactivate(vendor.id, org);
      expect(deactivated.isActive).toBe(false);

      expect((await repo.getById(vendor.id, org)).isActive).toBe(false);
      const after = await repo.list(org, { page: 1, pageSize: 100 });
      expect(after.items.some((v) => v.id === vendor.id)).toBe(false);
      expect(after.total).toBe(before.total - 1);
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.deactivate("00000000-0000-0000-0000-000000000000", orgId),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
