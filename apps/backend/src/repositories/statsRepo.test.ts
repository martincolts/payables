import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStatsRepo, type StatsRepo } from "./statsRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";
import { seedOrg } from "../test/repoHelpers.js";
import { bills, vendors } from "../db/schema/index.js";
import type { BillStatus } from "@payables/shared";

type SeededVendor = { id: string; name: string };

async function seedVendor(
  db: TestDb["db"],
  organizationId: string,
  name: string,
): Promise<SeededVendor> {
  const [row] = await db
    .insert(vendors)
    .values({
      organizationId,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random()
        .toString(36)
        .slice(2)}@ex.com`,
      paymentMethod: "ach",
    })
    .returning();
  return { id: row!.id, name: row!.name };
}

async function seedBill(
  db: TestDb["db"],
  organizationId: string,
  vendorId: string,
  createdBy: string,
  amount: string,
  status: BillStatus,
  issueDate: string,
): Promise<void> {
  await db.insert(bills).values({
    organizationId,
    vendorId,
    amount,
    status,
    issueDate,
    dueDate: issueDate,
    createdBy,
  });
}

describe("statsRepo", () => {
  let testDb: TestDb;
  let repo: StatsRepo;
  let orgId: string;
  let userId: string;
  let acme: SeededVendor;
  let globex: SeededVendor;
  let initech: SeededVendor;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createStatsRepo(testDb.db);
    ({ organizationId: orgId, ownerId: userId } = await seedOrg(testDb.db));

    acme = await seedVendor(testDb.db, orgId, "Acme");
    globex = await seedVendor(testDb.db, orgId, "Globex");
    initech = await seedVendor(testDb.db, orgId, "Initech");

    // Acme: 100 + 200 paid, draft
    await seedBill(testDb.db, orgId, acme.id, userId, "100.00", "paid", "2026-03-15");
    await seedBill(testDb.db, orgId, acme.id, userId, "200.00", "draft", "2026-04-01");
    // Globex: 1000 approved (largest)
    await seedBill(testDb.db, orgId, globex.id, userId, "1000.00", "approved", "2026-02-10");
    // Initech: 50 pending_approval
    await seedBill(testDb.db, orgId, initech.id, userId, "50.00", "pending_approval", "2026-05-01");
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  const EPOCH = new Date(Date.UTC(2000, 0, 1));

  describe("topVendorsByAmount", () => {
    it("orders vendors by total amount desc", async () => {
      const rows = await repo.topVendorsByAmount(orgId, EPOCH);
      expect(rows.map((r) => r.vendorName)).toEqual(["Globex", "Acme", "Initech"]);
      expect(rows[0]!.totalAmount).toBe("1000.00");
      expect(rows[1]!.totalAmount).toBe("300.00");
      expect(rows[1]!.billCount).toBe(2);
    });

    it("respects the limit", async () => {
      const rows = await repo.topVendorsByAmount(orgId, EPOCH, 2);
      expect(rows).toHaveLength(2);
    });

    it("scopes to org", async () => {
      const { organizationId: otherOrg } = await seedOrg(testDb.db);
      const rows = await repo.topVendorsByAmount(otherOrg, EPOCH);
      expect(rows).toEqual([]);
    });

    it("excludes bills issued before `since`", async () => {
      const rows = await repo.topVendorsByAmount(orgId, new Date(Date.UTC(2026, 4, 1)));
      expect(rows.map((r) => r.vendorName)).toEqual(["Initech"]);
    });
  });

  describe("countsByStatus", () => {
    it("groups bills by status", async () => {
      const rows = await repo.countsByStatus(orgId, EPOCH);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, r]));
      expect(byStatus.paid!.count).toBe(1);
      expect(byStatus.paid!.totalAmount).toBe("100.00");
      expect(byStatus.approved!.count).toBe(1);
      expect(byStatus.approved!.totalAmount).toBe("1000.00");
      expect(byStatus.draft!.count).toBe(1);
      expect(byStatus.pending_approval!.count).toBe(1);
    });

    it("excludes bills issued before `since`", async () => {
      const rows = await repo.countsByStatus(orgId, new Date(Date.UTC(2026, 4, 1)));
      expect(rows.map((r) => r.status).sort()).toEqual(["pending_approval"]);
    });
  });

  describe("monthlyByVendor", () => {
    it("returns monthly buckets for the given vendor ids", async () => {
      const rows = await repo.monthlyByVendor(orgId, EPOCH, [acme.id, globex.id]);
      const acmeMar = rows.find((r) => r.vendorId === acme.id && r.month === "2026-03");
      const globexFeb = rows.find((r) => r.vendorId === globex.id && r.month === "2026-02");
      expect(acmeMar!.totalAmount).toBe("100.00");
      expect(globexFeb!.totalAmount).toBe("1000.00");
      expect(rows.find((r) => r.vendorId === initech.id)).toBeUndefined();
    });

    it("returns [] when no vendor ids are given", async () => {
      const rows = await repo.monthlyByVendor(orgId, EPOCH, []);
      expect(rows).toEqual([]);
    });
  });

  describe("monthlyTotals", () => {
    it("buckets bills into YYYY-MM groups", async () => {
      const rows = await repo.monthlyTotals(orgId, new Date(Date.UTC(2026, 0, 1)));
      const byMonth = Object.fromEntries(rows.map((r) => [r.month, r]));
      expect(byMonth["2026-02"]!.totalAmount).toBe("1000.00");
      expect(byMonth["2026-03"]!.totalAmount).toBe("100.00");
      expect(byMonth["2026-04"]!.totalAmount).toBe("200.00");
      expect(byMonth["2026-05"]!.totalAmount).toBe("50.00");
    });

    it("excludes bills issued before `since`", async () => {
      const rows = await repo.monthlyTotals(orgId, new Date(Date.UTC(2026, 3, 1)));
      const months = rows.map((r) => r.month);
      expect(months).not.toContain("2026-02");
      expect(months).not.toContain("2026-03");
      expect(months).toContain("2026-04");
    });
  });
});
