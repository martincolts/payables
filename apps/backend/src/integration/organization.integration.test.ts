import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { authToken, inviteAndAcceptApprover, registerUser } from "../test/factories.js";

describe("organization (integration)", () => {
  let app: TestApp;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await authToken(app.client);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  it("rejects unauthenticated access with 401", async () => {
    const res = await app.client.api.organization.$get();
    expect(res.status).toBe(401);
  });

  it("returns the caller's organization with the default quorum", async () => {
    const res = await app.client.api.organization.$get({}, authHeaders(token));
    expect(res.status).toBe(200);
    const org = await res.json();
    expect(org.requiredApprovals).toBe(1);
    expect(typeof org.name).toBe("string");
  });

  it("lets an admin update name and required approvals", async () => {
    const res = await app.client.api.organization.$patch(
      { json: { name: "Renamed Co", requiredApprovals: 3 } },
      authHeaders(token),
    );
    expect(res.status).toBe(200);
    const org = await res.json();
    expect(org.name).toBe("Renamed Co");
    expect(org.requiredApprovals).toBe(3);
  });

  it("rejects an out-of-range quorum with 400", async () => {
    const res = await app.client.api.organization.$patch(
      { json: { requiredApprovals: 0 } },
      authHeaders(token),
    );
    expect(res.status).toBe(400);
  });

  it("forbids a non-admin from updating settings", async () => {
    const { token: approver } = await inviteAndAcceptApprover(app.client, token);
    const res = await app.client.api.organization.$patch(
      { json: { requiredApprovals: 2 } },
      authHeaders(approver),
    );
    expect(res.status).toBe(403);
  });

  describe("members", () => {
    it("lists the org's members for an admin", async () => {
      const own = await createTestApp();
      try {
        const { token: adminToken } = await registerUser(own.client, {
          email: "members-admin@example.com",
        });
        await inviteAndAcceptApprover(own.client, adminToken, {
          email: "member-1@example.com",
        });

        const res = await own.client.api.organization.members.$get(
          { query: {} },
          authHeaders(adminToken),
        );
        expect(res.status).toBe(200);
        const { items, total } = await res.json();
        expect(total).toBe(2); // admin + approver
        const emails = items.map((m) => m.email).sort();
        expect(emails).toContain("member-1@example.com");
      } finally {
        await own.cleanup();
      }
    });
  });
});
