import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BillListItem } from "@payables/shared";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import {
  authToken,
  createBill,
  createVendor,
  inviteAndAcceptApprover,
} from "../test/factories.js";

describe("approvals (integration)", () => {
  let app: TestApp;
  let admin: string;

  beforeAll(async () => {
    app = await createTestApp();
    admin = await authToken(app.client);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** Creates a bill and moves it to pending_approval. */
  async function pendingBill(): Promise<BillListItem> {
    const vendor = await createVendor(app.client, admin);
    const bill = await createBill(app.client, admin, vendor.id);
    const res = await app.client.api.bills[":id"].submit.$post(
      { param: { id: bill.id } },
      authHeaders(admin),
    );
    if (res.status !== 200) throw new Error(`submit failed: ${res.status}`);
    return res.json();
  }

  async function setQuorum(n: number): Promise<void> {
    const res = await app.client.api.organization.$patch(
      { json: { requiredApprovals: n } },
      authHeaders(admin),
    );
    if (res.status !== 200) throw new Error(`setQuorum failed: ${res.status}`);
  }

  function billStatus(id: string, token: string) {
    return app.client.api.bills[":id"]
      .$get({ param: { id } }, authHeaders(token))
      .then((r) => r.json())
      .then((b) => (b as BillListItem).status);
  }

  it("submit moves a draft bill to pending_approval", async () => {
    const bill = await pendingBill();
    expect(bill.status).toBe("pending_approval");
  });

  it("allows an admin to record a decision", async () => {
    await setQuorum(1);
    const bill = await pendingBill();
    const res = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(admin),
    );
    expect(res.status).toBe(201);
    expect(await billStatus(bill.id, admin)).toBe("approved");
  });

  it("with quorum 1, a single approval approves the bill", async () => {
    await setQuorum(1);
    const { token: approver } = await inviteAndAcceptApprover(app.client, admin);
    const bill = await pendingBill();

    const res = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(approver),
    );
    expect(res.status).toBe(201);
    const summary = await res.json();
    expect(summary.required).toBe(1);
    expect(summary.approved).toBe(1);
    expect(await billStatus(bill.id, admin)).toBe("approved");
  });

  it("with quorum 2, the bill stays pending until two distinct approvals", async () => {
    await setQuorum(2);
    const { token: a1 } = await inviteAndAcceptApprover(app.client, admin);
    const { token: a2 } = await inviteAndAcceptApprover(app.client, admin);
    const bill = await pendingBill();

    const first = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(a1),
    );
    expect((await first.json()).approved).toBe(1);
    expect(await billStatus(bill.id, admin)).toBe("pending_approval");

    const second = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(a2),
    );
    expect((await second.json()).approved).toBe(2);
    expect(await billStatus(bill.id, admin)).toBe("approved");
  });

  it("rejects a second decision from the same approver with 409", async () => {
    await setQuorum(2);
    const { token: approver } = await inviteAndAcceptApprover(app.client, admin);
    const bill = await pendingBill();

    await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(approver),
    );
    const dup = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(approver),
    );
    expect(dup.status).toBe(409);
  });

  it("a rejection moves the bill to rejected", async () => {
    const { token: approver } = await inviteAndAcceptApprover(app.client, admin);
    const bill = await pendingBill();

    const res = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "reject", comment: "Missing PO number" } },
      authHeaders(approver),
    );
    expect(res.status).toBe(201);
    expect(await billStatus(bill.id, admin)).toBe("rejected");
  });

  it("requires a comment when rejecting (400)", async () => {
    const { token: approver } = await inviteAndAcceptApprover(app.client, admin);
    const bill = await pendingBill();

    const res = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "reject" } },
      authHeaders(approver),
    );
    expect(res.status).toBe(400);
  });

  it("rejects voting on a bill that is not pending approval (409)", async () => {
    await setQuorum(1);
    const { token: approver } = await inviteAndAcceptApprover(app.client, admin);
    const bill = await pendingBill();
    // First approval approves it.
    await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(approver),
    );
    // A different approver now tries to vote on the already-approved bill.
    const { token: other } = await inviteAndAcceptApprover(app.client, admin);
    const res = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(other),
    );
    expect(res.status).toBe(409);
  });

  it("isolates approvals across organizations (404)", async () => {
    const bill = await pendingBill();
    // An approver in a different org must not be able to act on this bill.
    const otherAdmin = await authToken(app.client);
    const { token: foreignApprover } = await inviteAndAcceptApprover(
      app.client,
      otherAdmin,
    );
    const res = await app.client.api.bills[":id"].approvals.$post(
      { param: { id: bill.id }, json: { decision: "approve" } },
      authHeaders(foreignApprover),
    );
    expect(res.status).toBe(404);
  });
});
