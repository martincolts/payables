import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError } from "../types/errors.js";
import { createVendorRepo, type VendorRepo } from "./vendorRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";

describe("vendorRepo", () => {
  let testDb: TestDb;
  let repo: VendorRepo;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createVendorRepo(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("create", () => {
    it("inserts a vendor with bank details", async () => {
      const vendor = await repo.create({
        name: "Stripe",
        email: "billing@stripe.com",
        paymentMethod: "wire",
        bankLast4: "5678",
      });

      expect(vendor.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(vendor.name).toBe("Stripe");
      expect(vendor.email).toBe("billing@stripe.com");
      expect(vendor.paymentMethod).toBe("wire");
      expect(vendor.bankLast4).toBe("5678");
      expect(vendor.isActive).toBe(true);
      expect(typeof vendor.createdAt).toBe("string");
    });

    it("defaults bankLast4 to null when omitted", async () => {
      const vendor = await repo.create({
        name: "Figma",
        email: "ap@figma.com",
        paymentMethod: "ach",
      });
      expect(vendor.bankLast4).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns the vendor when it exists", async () => {
      const created = await repo.create({
        name: "Notion",
        email: "ap@notion.so",
        paymentMethod: "ach",
        bankLast4: "4321",
      });

      const found = await repo.getById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe("Notion");
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.getById("00000000-0000-0000-0000-000000000000"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("list", () => {
    // A dedicated DB per file means we control exactly what list sees.
    beforeAll(async () => {
      for (const name of ["Zeta", "Alpha", "Mu", "Beta"]) {
        await repo.create({ name, email: `${name}@v.com`, paymentMethod: "check" });
      }
    });

    it("orders by name and reports the total", async () => {
      const { items, total } = await repo.list({ page: 1, pageSize: 100 });
      // Includes the four above plus the three created in earlier blocks.
      expect(total).toBe(items.length);
      const names = items.map((v) => v.name);
      expect(names).toEqual([...names].sort());
    });

    it("paginates without exposing an offset", async () => {
      const { items: all } = await repo.list({ page: 1, pageSize: 100 });
      const firstPage = await repo.list({ page: 1, pageSize: 2 });
      const secondPage = await repo.list({ page: 2, pageSize: 2 });

      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.total).toBe(all.length);
      expect(secondPage.total).toBe(all.length);
      // Page 2 continues where page 1 left off.
      expect(secondPage.items[0]!.id).toBe(all[2]!.id);
    });
  });

  describe("deactivate", () => {
    it("marks the vendor inactive and hides it from the list", async () => {
      const vendor = await repo.create({
        name: "Soon Gone",
        email: "bye@v.com",
        paymentMethod: "ach",
      });

      const before = await repo.list({ page: 1, pageSize: 100 });
      expect(before.items.some((v) => v.id === vendor.id)).toBe(true);

      const deactivated = await repo.deactivate(vendor.id);
      expect(deactivated.isActive).toBe(false);

      // Still fetchable directly (existing bills reference it)...
      expect((await repo.getById(vendor.id)).isActive).toBe(false);
      // ...but excluded from the active-only list.
      const after = await repo.list({ page: 1, pageSize: 100 });
      expect(after.items.some((v) => v.id === vendor.id)).toBe(false);
      expect(after.total).toBe(before.total - 1);
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.deactivate("00000000-0000-0000-0000-000000000000"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
