import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { approverToken, authToken, createVendor } from "../test/factories.js";

describe("vendors (integration)", () => {
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
      const res = await app.client.api.vendors.$get({ query: {} });
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated create with 401", async () => {
      const res = await app.client.api.vendors.$post({
        json: { name: "X", email: "x@example.com", paymentMethod: "ach" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/vendors", () => {
    it("creates a vendor and returns it (201)", async () => {
      const res = await app.client.api.vendors.$post(
        {
          json: {
            name: "Acme Inc",
            email: "ap@acme.com",
            paymentMethod: "wire",
            bankLast4: "9876",
          },
        },
        authHeaders(token),
      );

      expect(res.status).toBe(201);
      const vendor = await res.json();
      expect(vendor.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(vendor).toMatchObject({
        name: "Acme Inc",
        email: "ap@acme.com",
        paymentMethod: "wire",
        bankLast4: "9876",
      });
    });

    it("defaults bankLast4 to null when omitted", async () => {
      const vendor = await createVendor(app.client, token, { bankLast4: null });
      expect(vendor.bankLast4).toBeNull();
    });

    it("rejects an invalid payment method with 400", async () => {
      const res = await app.client.api.vendors.$post(
        // @ts-expect-error — exercising the validator with a bad enum value
        { json: { name: "Bad", email: "bad@example.com", paymentMethod: "crypto" } },
        authHeaders(token),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/vendors/:id", () => {
    it("returns a previously-created vendor", async () => {
      const created = await createVendor(app.client, token, { name: "Lookup Co" });

      const res = await app.client.api.vendors[":id"].$get(
        { param: { id: created.id } },
        authHeaders(token),
      );

      expect(res.status).toBe(200);
      const vendor = await res.json();
      expect(vendor.id).toBe(created.id);
      expect(vendor.name).toBe("Lookup Co");
    });

    it("returns 404 for an unknown id", async () => {
      const res = await app.client.api.vendors[":id"].$get(
        { param: { id: "00000000-0000-0000-0000-000000000000" } },
        authHeaders(token),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/vendors (pagination)", () => {
    // Own app/database so the count contract isn't perturbed by other tests.
    let listApp: TestApp;
    let listToken: string;

    beforeAll(async () => {
      listApp = await createTestApp();
      listToken = await authToken(listApp.client);
      for (let i = 0; i < 3; i++) {
        await createVendor(listApp.client, listToken, { name: `Vendor ${i}` });
      }
    });

    afterAll(async () => {
      await listApp.cleanup();
    });

    it("reports the full total while truncating items to pageSize", async () => {
      const res = await listApp.client.api.vendors.$get(
        { query: { page: "1", pageSize: "2" } },
        authHeaders(listToken),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.items).toHaveLength(2);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(2);
      expect(body.totalPages).toBe(2);
    });

    it("continues onto page 2 without overlap", async () => {
      const auth = authHeaders(listToken);
      const page1 = await (
        await listApp.client.api.vendors.$get({ query: { page: "1", pageSize: "2" } }, auth)
      ).json();
      const page2 = await (
        await listApp.client.api.vendors.$get({ query: { page: "2", pageSize: "2" } }, auth)
      ).json();

      expect(page2.items).toHaveLength(1);
      const ids = new Set(page1.items.map((v) => v.id));
      expect(ids.has(page2.items[0]!.id)).toBe(false);
    });
  });

  describe("admin gate", () => {
    it("rejects create from a non-admin with 403", async () => {
      const approver = await approverToken(app);
      const res = await app.client.api.vendors.$post(
        { json: { name: "Nope", email: "nope@example.com", paymentMethod: "ach" } },
        authHeaders(approver),
      );
      expect(res.status).toBe(403);
    });

    it("rejects delete from a non-admin with 403", async () => {
      const approver = await approverToken(app);
      const vendor = await createVendor(app.client, token);
      const res = await app.client.api.vendors[":id"].$delete(
        { param: { id: vendor.id } },
        authHeaders(approver),
      );
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/vendors/:id", () => {
    it("deactivates the vendor and hides it from the list", async () => {
      const own = await createTestApp();
      const ownToken = await authToken(own.client);
      const vendor = await createVendor(own.client, ownToken, { name: "Goodbye Co" });

      const res = await own.client.api.vendors[":id"].$delete(
        { param: { id: vendor.id } },
        authHeaders(ownToken),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).isActive).toBe(false);

      const list = await (
        await own.client.api.vendors.$get({ query: {} }, authHeaders(ownToken))
      ).json();
      expect(list.items.some((v) => v.id === vendor.id)).toBe(false);

      await own.cleanup();
    });

    it("returns 404 for an unknown id", async () => {
      const res = await app.client.api.vendors[":id"].$delete(
        { param: { id: "00000000-0000-0000-0000-000000000000" } },
        authHeaders(token),
      );
      expect(res.status).toBe(404);
    });
  });
});
