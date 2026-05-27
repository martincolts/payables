import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { approverToken, authToken, createBill, createVendor } from "../test/factories.js";

describe("bills (integration)", () => {
  let app: TestApp;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await authToken(app.client);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  describe("auth gate", () => {
    it("rejects unauthenticated list with 401", async () => {
      const res = await app.client.api.bills.$get({ query: {} });
      expect(res.status).toBe(401);
    });

    it("rejects create from a non-admin with 403", async () => {
      const approver = await approverToken(app);
      const vendor = await createVendor(app.client, token);
      const res = await app.client.api.bills.$post(
        {
          json: {
            vendorId: vendor.id,
            issueDate: "2026-01-01",
            dueDate: "2026-02-01",
            lineItems: [{ description: "X", amount: "10.00" }],
          },
        },
        authHeaders(approver),
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/bills", () => {
    it("returns an empty, well-formed page when there are no bills", async () => {
      const res = await app.client.api.bills.$get({ query: {} }, authHeaders(token));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.page).toBe(1);
      expect(body.totalPages).toBe(1);
    });
  });

  describe("GET /api/bills/:id", () => {
    it("returns 404 for an unknown id", async () => {
      const res = await app.client.api.bills[":id"].$get(
        { param: { id: "00000000-0000-0000-0000-000000000000" } },
        authHeaders(token),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/bills", () => {
    it("creates a draft bill, summing line items into the total", async () => {
      const vendor = await createVendor(app.client, token, { name: "Bill Vendor" });
      const res = await app.client.api.bills.$post(
        {
          json: {
            vendorId: vendor.id,
            invoiceNumber: "INV-100",
            issueDate: "2026-03-01",
            dueDate: "2026-04-01",
            lineItems: [
              { description: "Setup", amount: "40.00" },
              { description: "Support", amount: "60.50" },
            ],
          },
        },
        authHeaders(token),
      );

      expect(res.status).toBe(201);
      const bill = await res.json();
      expect(bill.amount).toBe("100.50");
      expect(bill.status).toBe("draft");
      expect(bill.vendorName).toBe("Bill Vendor");
    });

    it("rejects an empty line-item list with 400", async () => {
      const vendor = await createVendor(app.client, token);
      const res = await app.client.api.bills.$post(
        {
          json: {
            vendorId: vendor.id,
            issueDate: "2026-03-01",
            dueDate: "2026-04-01",
            lineItems: [],
          },
        },
        authHeaders(token),
      );
      expect(res.status).toBe(400);
    });

    it("rejects a bill for a deactivated vendor with 409", async () => {
      const vendor = await createVendor(app.client, token);
      await app.client.api.vendors[":id"].$delete(
        { param: { id: vendor.id } },
        authHeaders(token),
      );

      const res = await app.client.api.bills.$post(
        {
          json: {
            vendorId: vendor.id,
            issueDate: "2026-03-01",
            dueDate: "2026-04-01",
            lineItems: [{ description: "X", amount: "10.00" }],
          },
        },
        authHeaders(token),
      );
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/bills/:id", () => {
    it("deletes a draft bill (204)", async () => {
      const vendor = await createVendor(app.client, token);
      const bill = await createBill(app.client, token, vendor.id);

      const res = await app.client.api.bills[":id"].$delete(
        { param: { id: bill.id } },
        authHeaders(token),
      );
      expect(res.status).toBe(204);

      const after = await app.client.api.bills[":id"].$get(
        { param: { id: bill.id } },
        authHeaders(token),
      );
      expect(after.status).toBe(404);
    });

    it("refuses to delete a non-draft bill with 409", async () => {
      const vendor = await createVendor(app.client, token);
      const bill = await createBill(app.client, token, vendor.id);
      // Move it out of draft directly in the DB (no status endpoint here).
      const { bills } = await import("../db/schema/index.js");
      const { eq } = await import("drizzle-orm");
      await app.testDb.db
        .update(bills)
        .set({ status: "approved" })
        .where(eq(bills.id, bill.id));

      const res = await app.client.api.bills[":id"].$delete(
        { param: { id: bill.id } },
        authHeaders(token),
      );
      expect(res.status).toBe(409);
    });

    it("returns 404 for an unknown id", async () => {
      const res = await app.client.api.bills[":id"].$delete(
        { param: { id: "00000000-0000-0000-0000-000000000000" } },
        authHeaders(token),
      );
      expect(res.status).toBe(404);
    });

    it("rejects delete from a non-admin with 403", async () => {
      const approver = await approverToken(app);
      const vendor = await createVendor(app.client, token);
      const bill = await createBill(app.client, token, vendor.id);
      const res = await app.client.api.bills[":id"].$delete(
        { param: { id: bill.id } },
        authHeaders(approver),
      );
      expect(res.status).toBe(403);
    });
  });
});
