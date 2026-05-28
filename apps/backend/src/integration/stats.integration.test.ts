import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { authToken, createBill, createVendor } from "../test/factories.js";

describe("stats (integration)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  it("rejects unauthenticated callers with 401", async () => {
    const res = await app.client.api.stats.dashboard.$get({ query: {} });
    expect(res.status).toBe(401);
  });

  it("returns empty buckets for a fresh org", async () => {
    const own = await createTestApp();
    const token = await authToken(own.client);
    const res = await own.client.api.stats.dashboard.$get(
      { query: {} },
      authHeaders(token),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topVendors).toEqual([]);
    expect(body.byStatus).toEqual([]);
    expect(body.monthlyByVendor).toEqual([]);
    expect(body.summary).toEqual({
      totalOutstanding: "0",
      overdueCount: 0,
      pendingApprovalCount: 0,
    });
    // 12 zero-filled months by default.
    expect(body.monthly).toHaveLength(12);
    expect(body.monthly.every((m) => m.billCount === 0 && m.totalAmount === "0")).toBe(true);
    await own.cleanup();
  });

  it("aggregates bills per vendor, status, and month", async () => {
    const own = await createTestApp();
    const token = await authToken(own.client);
    const acme = await createVendor(own.client, token, { name: "Acme" });
    const globex = await createVendor(own.client, token, { name: "Globex" });

    await createBill(own.client, token, acme.id, {
      issueDate: "2026-03-01",
      dueDate: "2026-03-15",
      lineItems: [{ description: "x", amount: "100.00" }],
    });
    await createBill(own.client, token, globex.id, {
      issueDate: "2026-03-05",
      dueDate: "2026-04-01",
      lineItems: [{ description: "y", amount: "500.00" }],
    });

    const res = await own.client.api.stats.dashboard.$get(
      { query: {} },
      authHeaders(token),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.topVendors[0]!.vendorName).toBe("Globex");
    expect(body.topVendors[0]!.totalAmount).toBe("500.00");
    expect(body.topVendors[1]!.vendorName).toBe("Acme");

    const draft = body.byStatus.find((s) => s.status === "draft");
    expect(draft!.count).toBe(2);
    expect(draft!.totalAmount).toBe("600.00");

    const march = body.monthly.find((m) => m.month === "2026-03");
    expect(march!.billCount).toBe(2);
    expect(march!.totalAmount).toBe("600.00");

    expect(body.monthlyByVendor.map((s) => s.vendorName).sort()).toEqual([
      "Acme",
      "Globex",
    ]);
    const globexSeries = body.monthlyByVendor.find((s) => s.vendorName === "Globex");
    const globexMar = globexSeries!.points.find((p) => p.month === "2026-03");
    expect(globexMar!.totalAmount).toBe("500.00");

    await own.cleanup();
  });

  it("explicit from/to returns the exact month range", async () => {
    const own = await createTestApp();
    const token = await authToken(own.client);
    const res = await own.client.api.stats.dashboard.$get(
      { query: { from: "2026-01", to: "2026-06" } },
      authHeaders(token),
    );
    const body = await res.json();
    expect(body.monthly).toHaveLength(6);
    expect(body.from).toBe("2026-01");
    expect(body.to).toBe("2026-06");
    expect(body.monthly[0]!.month).toBe("2026-01");
    expect(body.monthly[5]!.month).toBe("2026-06");
    await own.cleanup();
  });

  it("rejects from > to", async () => {
    const own = await createTestApp();
    const token = await authToken(own.client);
    const res = await own.client.api.stats.dashboard.$get(
      { query: { from: "2026-06", to: "2026-01" } },
      authHeaders(token),
    );
    expect(res.status).toBe(400);
    await own.cleanup();
  });

  it("filters charts by statuses and returns per-status breakdowns", async () => {
    const own = await createTestApp();
    const token = await authToken(own.client);
    const acme = await createVendor(own.client, token, { name: "Acme" });

    await createBill(own.client, token, acme.id, {
      issueDate: "2026-03-01",
      dueDate: "2026-03-15",
      lineItems: [{ description: "x", amount: "100.00" }],
    });

    const res = await own.client.api.stats.dashboard.$get(
      { query: { statuses: "draft" } },
      authHeaders(token),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appliedStatuses).toEqual(["draft"]);
    expect(body.topVendors[0]!.vendorName).toBe("Acme");
    expect(body.topVendorsByStatus.length).toBeGreaterThan(0);
    expect(body.topVendorsByStatus[0]!.status).toBe("draft");
    const mar = body.monthlyByStatus.find((m) => m.month === "2026-03");
    expect(mar!.status).toBe("draft");
    expect(mar!.totalAmount).toBe("100.00");

    await own.cleanup();
  });

  it("rejects invalid status values", async () => {
    const own = await createTestApp();
    const token = await authToken(own.client);
    const res = await own.client.api.stats.dashboard.$get(
      { query: { statuses: "not-a-status" } },
      authHeaders(token),
    );
    expect(res.status).toBe(400);
    await own.cleanup();
  });

  describe("AP Aging", () => {
    it("requires auth", async () => {
      const res = await app.client.api.stats["ap-aging"].$get({ query: {} });
      expect(res.status).toBe(401);
    });

    it("returns vendor x bucket pivot with computed totals row", async () => {
      const own = await createTestApp();
      const token = await authToken(own.client);
      const alpha = await createVendor(own.client, token, { name: "Alpha" });
      const bravo = await createVendor(own.client, token, { name: "Bravo" });

      await createBill(own.client, token, alpha.id, {
        issueDate: "2026-01-01",
        dueDate: "2026-06-15",
        lineItems: [{ description: "x", amount: "100.00" }],
      });
      await createBill(own.client, token, alpha.id, {
        issueDate: "2026-01-01",
        dueDate: "2026-03-01",
        lineItems: [{ description: "x", amount: "400.00" }],
      });
      await createBill(own.client, token, bravo.id, {
        issueDate: "2026-01-01",
        dueDate: "2026-06-01",
        lineItems: [{ description: "x", amount: "1000.00" }],
      });

      const res = await own.client.api.stats["ap-aging"].$get(
        { query: { asOf: "2026-06-01" } },
        authHeaders(token),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asOf).toBe("2026-06-01");
      expect(body.rows.map((r) => r.vendorName)).toEqual(["Bravo", "Alpha"]);
      const alphaRow = body.rows.find((r) => r.vendorName === "Alpha")!;
      expect(alphaRow.buckets.current).toBe("100.00");
      expect(alphaRow.buckets.d90_plus).toBe("400.00");
      expect(alphaRow.total).toBe("500.00");
      expect(body.totals.total).toBe("1500.00");
      expect(body.totals.buckets.current).toBe("1100.00");
      expect(body.totals.buckets.d90_plus).toBe("400.00");

      await own.cleanup();
    });

    it("defaults asOf to today when omitted", async () => {
      const own = await createTestApp();
      const token = await authToken(own.client);
      const res = await own.client.api.stats["ap-aging"].$get(
        { query: {} },
        authHeaders(token),
      );
      const body = await res.json();
      expect(body.asOf).toBe(new Date().toISOString().slice(0, 10));
      await own.cleanup();
    });

    it("scopes to caller's org", async () => {
      const a = await createTestApp();
      const b = await createTestApp();
      const tokenA = await authToken(a.client);
      const tokenB = await authToken(b.client);
      const vendorB = await createVendor(b.client, tokenB, { name: "Other" });
      await createBill(b.client, tokenB, vendorB.id, {
        lineItems: [{ description: "x", amount: "777.00" }],
      });

      const res = await a.client.api.stats["ap-aging"].$get(
        { query: {} },
        authHeaders(tokenA),
      );
      const body = await res.json();
      expect(body.rows).toEqual([]);
      expect(body.totals.total).toBe("0.00");
      await a.cleanup();
      await b.cleanup();
    });

    it("CSV endpoint returns text/csv with header + totals row", async () => {
      const own = await createTestApp();
      const token = await authToken(own.client);
      const vendor = await createVendor(own.client, token, { name: "Acme" });
      await createBill(own.client, token, vendor.id, {
        issueDate: "2026-01-01",
        dueDate: "2026-06-15",
        lineItems: [{ description: "x", amount: "100.00" }],
      });

      const res = await own.client.api.stats["ap-aging.csv"].$get(
        { query: { asOf: "2026-06-01" } },
        authHeaders(token),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(res.headers.get("content-disposition")).toContain(
        "ap-aging-2026-06-01.csv",
      );
      const text = await res.text();
      const lines = text.trim().split("\n");
      expect(lines[0]).toBe("Vendor,Current,1-30,31-60,61-90,90+,Total");
      expect(lines[1]).toContain("Acme");
      expect(lines[lines.length - 1]).toMatch(/^Total,/);
      await own.cleanup();
    });
  });

  it("scopes to caller's org", async () => {
    const a = await createTestApp();
    const b = await createTestApp();
    const tokenA = await authToken(a.client);
    const tokenB = await authToken(b.client);
    const vendorB = await createVendor(b.client, tokenB, { name: "Other" });
    await createBill(b.client, tokenB, vendorB.id, {
      lineItems: [{ description: "x", amount: "9999.00" }],
    });

    const res = await a.client.api.stats.dashboard.$get(
      { query: {} },
      authHeaders(tokenA),
    );
    const body = await res.json();
    expect(body.topVendors).toEqual([]);
    await a.cleanup();
    await b.cleanup();
  });
});
