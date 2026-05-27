import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { authToken } from "../test/factories.js";

/**
 * The bills API is read-only (`GET /` and `GET /:id`) — there is no public
 * endpoint to create a bill, so these tests cover the auth gate, the empty-list
 * contract, and not-found. Add coverage of populated lists/filters here once a
 * bill-creation endpoint exists and `factories.ts` grows a `createBill` helper.
 */
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
});
