import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { billLineItems, bills, vendors } from "../db/schema/index.js";
import { NotFoundError } from "../types/errors.js";
import { createBillRepo, type BillRepo } from "./billRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";
import { seedOrg } from "../test/repoHelpers.js";

describe("billRepo", () => {
  let testDb: TestDb;
  let repo: BillRepo;

  // FK targets, populated in beforeAll.
  let orgId: string;
  let userId: string;
  let acmeId: string; // vendor "Acme"
  let globexId: string; // vendor "Globex"

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createBillRepo(testDb.db);
    const { db } = testDb;

    ({ organizationId: orgId, ownerId: userId } = await seedOrg(db));

    const vendorRows = await db
      .insert(vendors)
      .values([
        { organizationId: orgId, name: "Acme", email: "ap@acme.com", paymentMethod: "ach" },
        { organizationId: orgId, name: "Globex", email: "ap@globex.com", paymentMethod: "wire" },
      ])
      .returning();
    acmeId = vendorRows.find((v) => v.name === "Acme")!.id;
    globexId = vendorRows.find((v) => v.name === "Globex")!.id;

    // Insert separately so each row gets a distinct createdAt for ordering tests.
    await db.insert(bills).values({
      organizationId: orgId,
      vendorId: acmeId,
      invoiceNumber: "ACME-001",
      amount: "100.00",
      issueDate: "2026-01-01",
      dueDate: "2026-02-01",
      status: "approved",
      createdBy: userId,
    });
    await db.insert(bills).values({
      organizationId: orgId,
      vendorId: acmeId,
      invoiceNumber: "ACME-002",
      amount: "250.00",
      issueDate: "2026-01-10",
      dueDate: "2026-03-01",
      status: "draft",
      createdBy: userId,
    });
    await db.insert(bills).values({
      organizationId: orgId,
      vendorId: globexId,
      invoiceNumber: "GLX-555",
      amount: "999.00",
      issueDate: "2026-01-05",
      dueDate: "2026-02-15",
      status: "approved",
      createdBy: userId,
    });
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("list", () => {
    it("returns all bills with the joined vendor name", async () => {
      const { items, total } = await repo.list({ organizationId: orgId, page: 1, pageSize: 100 });
      expect(total).toBe(3);
      const acme002 = items.find((b) => b.invoiceNumber === "ACME-002");
      expect(acme002!.vendorName).toBe("Acme");
    });

    it("orders by createdAt descending (newest first)", async () => {
      const { items } = await repo.list({ organizationId: orgId, page: 1, pageSize: 100 });
      expect(items.map((b) => b.invoiceNumber)).toEqual(["GLX-555", "ACME-002", "ACME-001"]);
    });

    it("filters by status", async () => {
      const { items, total } = await repo.list({
        organizationId: orgId,
        page: 1,
        pageSize: 100,
        status: "approved",
      });
      expect(total).toBe(2);
      expect(items.every((b) => b.status === "approved")).toBe(true);
    });

    it("filters by vendorId", async () => {
      const { items, total } = await repo.list({
        organizationId: orgId,
        page: 1,
        pageSize: 100,
        vendorId: globexId,
      });
      expect(total).toBe(1);
      expect(items[0]!.invoiceNumber).toBe("GLX-555");
    });

    it("filters by due date range", async () => {
      const { items } = await repo.list({
        organizationId: orgId,
        page: 1,
        pageSize: 100,
        dueBefore: "2026-02-20",
        dueAfter: "2026-02-01",
      });
      const invoices = items.map((b) => b.invoiceNumber).sort();
      expect(invoices).toEqual(["ACME-001", "GLX-555"]);
    });

    it("searches across invoice number and vendor name", async () => {
      const byInvoice = await repo.list({ organizationId: orgId, page: 1, pageSize: 100, search: "GLX" });
      expect(byInvoice.total).toBe(1);
      expect(byInvoice.items[0]!.invoiceNumber).toBe("GLX-555");

      const byVendor = await repo.list({ organizationId: orgId, page: 1, pageSize: 100, search: "Acme" });
      expect(byVendor.total).toBe(2);
    });

    it("paginates while reporting the unpaged total", async () => {
      const firstPage = await repo.list({ organizationId: orgId, page: 1, pageSize: 2 });
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.total).toBe(3);
    });

    it("does not list bills from another org", async () => {
      const { organizationId: otherOrg } = await seedOrg(testDb.db);
      const { total } = await repo.list({ organizationId: otherOrg, page: 1, pageSize: 100 });
      expect(total).toBe(0);
    });

    it("filters by overdue=true (past-due and not paid)", async () => {
      const { organizationId: org, ownerId } = await seedOrg(testDb.db);
      const [vendor] = await testDb.db
        .insert(vendors)
        .values({ organizationId: org, name: "OverdueCo", email: "ap@od.com", paymentMethod: "ach" })
        .returning();
      const today = new Date().toISOString().slice(0, 10);
      const past = "2020-01-01";
      const future = "2999-01-01";
      await testDb.db.insert(bills).values([
        { organizationId: org, vendorId: vendor!.id, invoiceNumber: "OD-PAST-APPROVED", amount: "10.00", issueDate: past, dueDate: past, status: "approved", createdBy: ownerId },
        { organizationId: org, vendorId: vendor!.id, invoiceNumber: "OD-PAST-PAID", amount: "10.00", issueDate: past, dueDate: past, status: "paid", createdBy: ownerId },
        { organizationId: org, vendorId: vendor!.id, invoiceNumber: "OD-FUTURE-APPROVED", amount: "10.00", issueDate: today, dueDate: future, status: "approved", createdBy: ownerId },
        { organizationId: org, vendorId: vendor!.id, invoiceNumber: "OD-PAST-DRAFT", amount: "10.00", issueDate: past, dueDate: past, status: "draft", createdBy: ownerId },
      ]);

      const { items, total } = await repo.list({
        organizationId: org,
        page: 1,
        pageSize: 100,
        overdue: true,
      });
      expect(total).toBe(2);
      expect(items.map((b) => b.invoiceNumber).sort()).toEqual([
        "OD-PAST-APPROVED",
        "OD-PAST-DRAFT",
      ]);

      // Combined with status: only the approved one.
      const approvedOverdue = await repo.list({
        organizationId: org,
        page: 1,
        pageSize: 100,
        overdue: true,
        status: "approved",
      });
      expect(approvedOverdue.total).toBe(1);
      expect(approvedOverdue.items[0]!.invoiceNumber).toBe("OD-PAST-APPROVED");
    });
  });

  describe("getById", () => {
    it("returns the bill with its vendor name", async () => {
      const { items } = await repo.list({ organizationId: orgId, page: 1, pageSize: 1 });
      const target = items[0]!;

      const found = await repo.getById(target.id, orgId);
      expect(found.id).toBe(target.id);
      expect(found.vendorName).toBe(target.vendorName);
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.getById("00000000-0000-0000-0000-000000000000", orgId),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("does not return a bill from another org", async () => {
      const { organizationId: otherOrg } = await seedOrg(testDb.db);
      const { items } = await repo.list({ organizationId: orgId, page: 1, pageSize: 1 });
      await expect(repo.getById(items[0]!.id, otherOrg)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("create", () => {
    it("inserts a bill plus line items and sums the total amount", async () => {
      const created = await repo.create(
        {
          vendorId: acmeId,
          invoiceNumber: "ACME-NEW",
          issueDate: "2026-04-01",
          dueDate: "2026-05-01",
          memo: "Quarterly retainer",
          lineItems: [
            { description: "Design", amount: "30.50" },
            { description: "Hosting", amount: "19.50", category: "infra" },
          ],
        },
        userId,
        orgId,
      );

      expect(created.amount).toBe("50.00");
      expect(created.status).toBe("draft");
      expect(created.vendorName).toBe("Acme");
      expect(created.createdBy).toBe(userId);

      const rows = await testDb.db
        .select()
        .from(billLineItems)
        .where(eq(billLineItems.billId, created.id));
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.description === "Hosting")!.category).toBe("infra");
    });
  });

  describe("updateStatus", () => {
    it("transitions a bill's status", async () => {
      const created = await repo.create(
        {
          vendorId: acmeId,
          issueDate: "2026-04-01",
          dueDate: "2026-05-01",
          lineItems: [{ description: "Work", amount: "10.00" }],
        },
        userId,
        orgId,
      );

      const updated = await repo.updateStatus(created.id, orgId, "pending_approval");
      expect(updated.status).toBe("pending_approval");
      expect((await repo.getById(created.id, orgId)).status).toBe("pending_approval");
    });

    it("throws NotFoundError when the bill belongs to another org", async () => {
      const { organizationId: otherOrg } = await seedOrg(testDb.db);
      const { items } = await repo.list({ organizationId: orgId, page: 1, pageSize: 1 });
      await expect(
        repo.updateStatus(items[0]!.id, otherOrg, "approved"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("delete", () => {
    it("removes the bill and cascades its line items", async () => {
      const created = await repo.create(
        {
          vendorId: globexId,
          issueDate: "2026-04-01",
          dueDate: "2026-05-01",
          lineItems: [{ description: "One-off", amount: "10.00" }],
        },
        userId,
        orgId,
      );

      await repo.delete(created.id, orgId);

      await expect(repo.getById(created.id, orgId)).rejects.toBeInstanceOf(NotFoundError);
      const rows = await testDb.db
        .select()
        .from(billLineItems)
        .where(eq(billLineItems.billId, created.id));
      expect(rows).toHaveLength(0);
    });

    it("throws NotFoundError when deleting an unknown bill", async () => {
      await expect(
        repo.delete("00000000-0000-0000-0000-000000000000", orgId),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
