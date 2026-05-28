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
  const FAR_FUTURE = new Date(Date.UTC(2100, 0, 1));

  describe("topVendorsByAmount", () => {
    it("orders vendors by total amount desc", async () => {
      const rows = await repo.topVendorsByAmount(orgId, EPOCH, FAR_FUTURE);
      expect(rows.map((r) => r.vendorName)).toEqual(["Globex", "Acme", "Initech"]);
      expect(rows[0]!.totalAmount).toBe("1000.00");
      expect(rows[1]!.totalAmount).toBe("300.00");
      expect(rows[1]!.billCount).toBe(2);
    });

    it("respects the limit", async () => {
      const rows = await repo.topVendorsByAmount(orgId, EPOCH, FAR_FUTURE, 2);
      expect(rows).toHaveLength(2);
    });

    it("scopes to org", async () => {
      const { organizationId: otherOrg } = await seedOrg(testDb.db);
      const rows = await repo.topVendorsByAmount(otherOrg, EPOCH, FAR_FUTURE);
      expect(rows).toEqual([]);
    });

    it("excludes bills issued before `since`", async () => {
      const rows = await repo.topVendorsByAmount(
        orgId,
        new Date(Date.UTC(2026, 4, 1)),
        FAR_FUTURE,
      );
      expect(rows.map((r) => r.vendorName)).toEqual(["Initech"]);
    });

    it("excludes bills issued on/after `until`", async () => {
      const rows = await repo.topVendorsByAmount(
        orgId,
        EPOCH,
        new Date(Date.UTC(2026, 3, 1)),
      );
      expect(rows.map((r) => r.vendorName).sort()).toEqual(["Acme", "Globex"]);
    });
  });

  describe("countsByStatus", () => {
    it("groups bills by status", async () => {
      const rows = await repo.countsByStatus(orgId, EPOCH, FAR_FUTURE);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, r]));
      expect(byStatus.paid!.count).toBe(1);
      expect(byStatus.paid!.totalAmount).toBe("100.00");
      expect(byStatus.approved!.count).toBe(1);
      expect(byStatus.approved!.totalAmount).toBe("1000.00");
      expect(byStatus.draft!.count).toBe(1);
      expect(byStatus.pending_approval!.count).toBe(1);
    });

    it("excludes bills issued before `since`", async () => {
      const rows = await repo.countsByStatus(
        orgId,
        new Date(Date.UTC(2026, 4, 1)),
        FAR_FUTURE,
      );
      expect(rows.map((r) => r.status).sort()).toEqual(["pending_approval"]);
    });
  });

  describe("monthlyByVendor", () => {
    it("returns monthly buckets for the given vendor ids", async () => {
      const rows = await repo.monthlyByVendor(orgId, EPOCH, FAR_FUTURE, [
        acme.id,
        globex.id,
      ]);
      const acmeMar = rows.find((r) => r.vendorId === acme.id && r.month === "2026-03");
      const globexFeb = rows.find((r) => r.vendorId === globex.id && r.month === "2026-02");
      expect(acmeMar!.totalAmount).toBe("100.00");
      expect(globexFeb!.totalAmount).toBe("1000.00");
      expect(rows.find((r) => r.vendorId === initech.id)).toBeUndefined();
    });

    it("returns [] when no vendor ids are given", async () => {
      const rows = await repo.monthlyByVendor(orgId, EPOCH, FAR_FUTURE, []);
      expect(rows).toEqual([]);
    });
  });

  describe("summary", () => {
    it("aggregates outstanding amount and pending approval count", async () => {
      const row = await repo.summary(orgId, EPOCH, FAR_FUTURE, "2026-06-01");
      // Outstanding = all except `paid`. Acme paid 100 -> excluded. 200+1000+50=1250.
      expect(row.totalOutstanding).toBe("1250.00");
      expect(row.pendingApprovalCount).toBe(1);
    });

    it("counts overdue bills as those past today and not paid", async () => {
      // today=2026-04-15: due dates 2026-03-15 (acme paid → excluded), 2026-04-01 (draft, due 2026-04-01 < today → overdue), 2026-02-10 (approved → overdue), 2026-05-01 (pending, due 2026-05-01 → not yet)
      const row = await repo.summary(orgId, EPOCH, FAR_FUTURE, "2026-04-15");
      expect(row.overdueCount).toBe(2);
    });

    it("respects the date window", async () => {
      const row = await repo.summary(
        orgId,
        new Date(Date.UTC(2026, 4, 1)),
        FAR_FUTURE,
        "2026-06-01",
      );
      expect(row.totalOutstanding).toBe("50.00");
      expect(row.pendingApprovalCount).toBe(1);
    });
  });

  describe("statuses filter", () => {
    it("topVendorsByAmount filters by statuses", async () => {
      const rows = await repo.topVendorsByAmount(
        orgId,
        EPOCH,
        FAR_FUTURE,
        undefined,
        ["paid"],
      );
      expect(rows.map((r) => r.vendorName)).toEqual(["Acme"]);
      expect(rows[0]!.totalAmount).toBe("100.00");
    });

    it("monthlyTotals filters by statuses", async () => {
      const rows = await repo.monthlyTotals(orgId, EPOCH, FAR_FUTURE, [
        "approved",
        "pending_approval",
      ]);
      const byMonth = Object.fromEntries(rows.map((r) => [r.month, r]));
      expect(byMonth["2026-02"]!.totalAmount).toBe("1000.00");
      expect(byMonth["2026-05"]!.totalAmount).toBe("50.00");
      expect(byMonth["2026-03"]).toBeUndefined();
      expect(byMonth["2026-04"]).toBeUndefined();
    });
  });

  describe("topVendorsByStatus", () => {
    it("returns one row per vendor/status combo within filter", async () => {
      const rows = await repo.topVendorsByStatus(
        orgId,
        EPOCH,
        FAR_FUTURE,
        [acme.id, globex.id, initech.id],
        ["paid", "approved", "pending_approval"],
      );
      const key = (v: string, s: string) => `${v}:${s}`;
      const m = new Map(rows.map((r) => [key(r.vendorName, r.status), r]));
      expect(m.get(key("Acme", "paid"))!.totalAmount).toBe("100.00");
      expect(m.get(key("Globex", "approved"))!.totalAmount).toBe("1000.00");
      expect(m.get(key("Initech", "pending_approval"))!.totalAmount).toBe(
        "50.00",
      );
      expect(m.get(key("Acme", "draft"))).toBeUndefined();
    });

    it("returns [] when statuses or vendors empty", async () => {
      expect(
        await repo.topVendorsByStatus(orgId, EPOCH, FAR_FUTURE, [], ["paid"]),
      ).toEqual([]);
      expect(
        await repo.topVendorsByStatus(orgId, EPOCH, FAR_FUTURE, [acme.id], []),
      ).toEqual([]);
    });
  });

  describe("monthlyByStatus", () => {
    it("buckets per (month, status)", async () => {
      const rows = await repo.monthlyByStatus(orgId, EPOCH, FAR_FUTURE, [
        "paid",
        "draft",
      ]);
      const key = (m: string, s: string) => `${m}:${s}`;
      const map = new Map(rows.map((r) => [key(r.month, r.status), r]));
      expect(map.get(key("2026-03", "paid"))!.totalAmount).toBe("100.00");
      expect(map.get(key("2026-04", "draft"))!.totalAmount).toBe("200.00");
      expect(map.get(key("2026-02", "approved"))).toBeUndefined();
    });

    it("returns [] when statuses empty", async () => {
      expect(await repo.monthlyByStatus(orgId, EPOCH, FAR_FUTURE, [])).toEqual([]);
    });
  });

  describe("monthlyTotals", () => {
    it("buckets bills into YYYY-MM groups", async () => {
      const rows = await repo.monthlyTotals(
        orgId,
        new Date(Date.UTC(2026, 0, 1)),
        FAR_FUTURE,
      );
      const byMonth = Object.fromEntries(rows.map((r) => [r.month, r]));
      expect(byMonth["2026-02"]!.totalAmount).toBe("1000.00");
      expect(byMonth["2026-03"]!.totalAmount).toBe("100.00");
      expect(byMonth["2026-04"]!.totalAmount).toBe("200.00");
      expect(byMonth["2026-05"]!.totalAmount).toBe("50.00");
    });

    it("excludes bills issued before `since`", async () => {
      const rows = await repo.monthlyTotals(
        orgId,
        new Date(Date.UTC(2026, 3, 1)),
        FAR_FUTURE,
      );
      const months = rows.map((r) => r.month);
      expect(months).not.toContain("2026-02");
      expect(months).not.toContain("2026-03");
      expect(months).toContain("2026-04");
    });
  });
});
