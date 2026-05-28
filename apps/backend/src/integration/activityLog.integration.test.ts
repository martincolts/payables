import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import {
  approverToken,
  authToken,
  createBill,
  createVendor,
  inviteAndAcceptApprover,
  registerUser,
} from "../test/factories.js";

describe("activity-log (integration)", () => {
  describe("auth + admin gate", () => {
    let app: TestApp;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.cleanup();
    });

    it("rejects unauthenticated callers with 401", async () => {
      const res = await app.client.api["activity-log"].$get({ query: {} });
      expect(res.status).toBe(401);
    });

    it("rejects non-admin callers with 403", async () => {
      const approver = await approverToken(app);
      const res = await app.client.api["activity-log"].$get(
        { query: {} },
        authHeaders(approver),
      );
      expect(res.status).toBe(403);
    });
  });

  describe("recording", () => {
    // Each scenario uses its own app+org so the list assertions aren't perturbed
    // by side-effects from elsewhere in this suite.
    it("records vendor_created and vendor_deactivated", async () => {
      const own = await createTestApp();
      const token = await authToken(own.client);
      const vendor = await createVendor(own.client, token, { name: "Acme" });
      const delRes = await own.client.api.vendors[":id"].$delete(
        { param: { id: vendor.id } },
        authHeaders(token),
      );
      expect(delRes.status).toBe(200);

      const res = await own.client.api["activity-log"].$get(
        { query: {} },
        authHeaders(token),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const actions = body.items.map((e) => e.action);
      expect(actions).toEqual(["vendor_deactivated", "vendor_created"]);
      expect(body.items.every((e) => e.entityId === vendor.id)).toBe(true);
      expect(body.items.every((e) => e.entityType === "vendor")).toBe(true);
      expect(body.items[1]!.metadata).toMatchObject({ name: "Acme" });

      await own.cleanup();
    });

    it("records bill_created, bill_submitted, bill_approved (with comment)", async () => {
      const own = await createTestApp();
      const { token: adminToken, user: admin } = await registerUser(own.client);

      // 1-approval org by default, so a single approve flips the bill.
      const { token: approverTokenStr, user: approver } = await inviteAndAcceptApprover(
        own.client,
        adminToken,
      );

      const vendor = await createVendor(own.client, adminToken);
      const bill = await createBill(own.client, adminToken, vendor.id);

      await own.client.api.bills[":id"].submit.$post(
        { param: { id: bill.id } },
        authHeaders(adminToken),
      );
      await own.client.api.bills[":id"].approvals.$post(
        { param: { id: bill.id }, json: { decision: "approve", comment: "LGTM" } },
        authHeaders(approverTokenStr),
      );

      const res = await own.client.api["activity-log"].$get(
        { query: {} },
        authHeaders(adminToken),
      );
      const body = await res.json();
      const billEntries = body.items.filter((e) => e.entityId === bill.id);
      expect(billEntries.map((e) => e.action)).toEqual([
        "bill_approved",
        "bill_submitted",
        "bill_created",
      ]);
      const approved = billEntries[0]!;
      expect(approved.userId).toBe(approver.id);
      expect(approved.metadata).toMatchObject({ comment: "LGTM" });
      const created = billEntries[2]!;
      expect(created.userId).toBe(admin.id);
      expect(created.metadata).toMatchObject({ vendorId: vendor.id });

      await own.cleanup();
    });

    it("records bill_rejected on a reject decision", async () => {
      const own = await createTestApp();
      const { token: adminToken } = await registerUser(own.client);
      const { token: approverTokenStr } = await inviteAndAcceptApprover(own.client, adminToken);

      const vendor = await createVendor(own.client, adminToken);
      const bill = await createBill(own.client, adminToken, vendor.id);
      await own.client.api.bills[":id"].submit.$post(
        { param: { id: bill.id } },
        authHeaders(adminToken),
      );
      await own.client.api.bills[":id"].approvals.$post(
        { param: { id: bill.id }, json: { decision: "reject", comment: "wrong" } },
        authHeaders(approverTokenStr),
      );

      const res = await own.client.api["activity-log"].$get(
        { query: { action: "bill_rejected" } },
        authHeaders(adminToken),
      );
      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.items[0]!.entityId).toBe(bill.id);
      expect(body.items[0]!.metadata).toMatchObject({ comment: "wrong" });

      await own.cleanup();
    });

    it("records bill_deleted on a draft-bill delete", async () => {
      const own = await createTestApp();
      const token = await authToken(own.client);
      const vendor = await createVendor(own.client, token);
      const bill = await createBill(own.client, token, vendor.id);

      const del = await own.client.api.bills[":id"].$delete(
        { param: { id: bill.id } },
        authHeaders(token),
      );
      expect(del.status).toBe(204);

      const res = await own.client.api["activity-log"].$get(
        { query: { action: "bill_deleted" } },
        authHeaders(token),
      );
      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.items[0]!.entityId).toBe(bill.id);

      await own.cleanup();
    });
  });

  describe("filters & scoping", () => {
    it("filters by userId and by action, and scopes to the caller's org", async () => {
      const own = await createTestApp();
      const { token: adminToken, user: admin } = await registerUser(own.client);
      const { token: approverTokenStr, user: approver } = await inviteAndAcceptApprover(
        own.client,
        adminToken,
      );

      // Admin creates a vendor; approver approves a bill — two distinct users.
      const vendor = await createVendor(own.client, adminToken);
      const bill = await createBill(own.client, adminToken, vendor.id);
      await own.client.api.bills[":id"].submit.$post(
        { param: { id: bill.id } },
        authHeaders(adminToken),
      );
      await own.client.api.bills[":id"].approvals.$post(
        { param: { id: bill.id }, json: { decision: "approve" } },
        authHeaders(approverTokenStr),
      );

      // A second org with its own activity — must not leak into the first.
      const other = await createTestApp();
      const otherToken = await authToken(other.client);
      await createVendor(other.client, otherToken, { name: "Other Org Vendor" });

      const byUser = await (
        await own.client.api["activity-log"].$get(
          { query: { userId: approver.id } },
          authHeaders(adminToken),
        )
      ).json();
      expect(byUser.items.every((e) => e.userId === approver.id)).toBe(true);
      expect(byUser.items.map((e) => e.action)).toEqual(["bill_approved"]);

      const byAction = await (
        await own.client.api["activity-log"].$get(
          { query: { action: "vendor_created" } },
          authHeaders(adminToken),
        )
      ).json();
      expect(byAction.items.every((e) => e.action === "vendor_created")).toBe(true);
      expect(byAction.items[0]!.userId).toBe(admin.id);

      // No "Other Org Vendor" should be visible to this org's admin.
      const all = await (
        await own.client.api["activity-log"].$get({ query: {} }, authHeaders(adminToken))
      ).json();
      expect(
        all.items.some(
          (e) =>
            typeof e.metadata === "object" &&
            e.metadata !== null &&
            (e.metadata as { name?: string }).name === "Other Org Vendor",
        ),
      ).toBe(false);

      await own.cleanup();
      await other.cleanup();
    });

    it("paginates newest-first", async () => {
      const own = await createTestApp();
      const token = await authToken(own.client);
      for (let i = 0; i < 3; i++) {
        await createVendor(own.client, token, { name: `V${i}` });
      }
      const page1 = await (
        await own.client.api["activity-log"].$get(
          { query: { page: "1", pageSize: "2" } },
          authHeaders(token),
        )
      ).json();
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.totalPages).toBe(2);
      // Newest first → V2 then V1 on page 1.
      expect((page1.items[0]!.metadata as { name?: string }).name).toBe("V2");
      expect((page1.items[1]!.metadata as { name?: string }).name).toBe("V1");

      await own.cleanup();
    });
  });
});
