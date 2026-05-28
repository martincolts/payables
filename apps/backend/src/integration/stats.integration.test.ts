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
      { query: { range: "12m" } },
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

  it("range=6m returns 6 monthly buckets", async () => {
    const own = await createTestApp();
    const token = await authToken(own.client);
    const res = await own.client.api.stats.dashboard.$get(
      { query: { range: "6m" } },
      authHeaders(token),
    );
    const body = await res.json();
    expect(body.monthly).toHaveLength(6);
    await own.cleanup();
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
