import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bills, users, vendors } from "../db/schema/index.js";
import { NotFoundError } from "../types/errors.js";
import { createBillRepo, type BillRepo } from "./billRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";

describe("billRepo", () => {
  let testDb: TestDb;
  let repo: BillRepo;

  // FK targets, populated in beforeAll.
  let userId: string;
  let acmeId: string; // vendor "Acme"
  let globexId: string; // vendor "Globex"

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createBillRepo(testDb.db);
    const { db } = testDb;

    const [user] = await db
      .insert(users)
      .values({
        name: "Admin",
        email: "admin@example.com",
        passwordHash: "scrypt$00$11",
        role: "admin",
      })
      .returning();
    userId = user!.id;

    const vendorRows = await db
      .insert(vendors)
      .values([
        { name: "Acme", email: "ap@acme.com", paymentMethod: "ach" },
        { name: "Globex", email: "ap@globex.com", paymentMethod: "wire" },
      ])
      .returning();
    acmeId = vendorRows.find((v) => v.name === "Acme")!.id;
    globexId = vendorRows.find((v) => v.name === "Globex")!.id;

    await db.insert(bills).values([
      {
        vendorId: acmeId,
        invoiceNumber: "ACME-001",
        amount: "100.00",
        issueDate: "2026-01-01",
        dueDate: "2026-02-01",
        status: "approved",
        createdBy: userId,
      },
      {
        vendorId: acmeId,
        invoiceNumber: "ACME-002",
        amount: "250.00",
        issueDate: "2026-01-10",
        dueDate: "2026-03-01",
        status: "draft",
        createdBy: userId,
      },
      {
        vendorId: globexId,
        invoiceNumber: "GLX-555",
        amount: "999.00",
        issueDate: "2026-01-05",
        dueDate: "2026-02-15",
        status: "approved",
        createdBy: userId,
      },
    ]);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("list", () => {
    it("returns all bills with the joined vendor name", async () => {
      const { items, total } = await repo.list({ page: 1, pageSize: 100 });
      expect(total).toBe(3);
      const acme002 = items.find((b) => b.invoiceNumber === "ACME-002");
      expect(acme002!.vendorName).toBe("Acme");
    });

    it("orders by due date ascending", async () => {
      const { items } = await repo.list({ page: 1, pageSize: 100 });
      const dueDates = items.map((b) => b.dueDate);
      expect(dueDates).toEqual([...dueDates].sort());
    });

    it("filters by status", async () => {
      const { items, total } = await repo.list({
        page: 1,
        pageSize: 100,
        status: "approved",
      });
      expect(total).toBe(2);
      expect(items.every((b) => b.status === "approved")).toBe(true);
    });

    it("filters by vendorId", async () => {
      const { items, total } = await repo.list({
        page: 1,
        pageSize: 100,
        vendorId: globexId,
      });
      expect(total).toBe(1);
      expect(items[0]!.invoiceNumber).toBe("GLX-555");
    });

    it("filters by due date range", async () => {
      const { items } = await repo.list({
        page: 1,
        pageSize: 100,
        dueBefore: "2026-02-20",
        dueAfter: "2026-02-01",
      });
      const invoices = items.map((b) => b.invoiceNumber).sort();
      expect(invoices).toEqual(["ACME-001", "GLX-555"]);
    });

    it("searches across invoice number and vendor name", async () => {
      const byInvoice = await repo.list({ page: 1, pageSize: 100, search: "GLX" });
      expect(byInvoice.total).toBe(1);
      expect(byInvoice.items[0]!.invoiceNumber).toBe("GLX-555");

      const byVendor = await repo.list({ page: 1, pageSize: 100, search: "Acme" });
      expect(byVendor.total).toBe(2);
    });

    it("paginates while reporting the unpaged total", async () => {
      const firstPage = await repo.list({ page: 1, pageSize: 2 });
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.total).toBe(3);
    });
  });

  describe("getById", () => {
    it("returns the bill with its vendor name", async () => {
      const { items } = await repo.list({ page: 1, pageSize: 1 });
      const target = items[0]!;

      const found = await repo.getById(target.id);
      expect(found.id).toBe(target.id);
      expect(found.vendorName).toBe(target.vendorName);
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.getById("00000000-0000-0000-0000-000000000000"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
