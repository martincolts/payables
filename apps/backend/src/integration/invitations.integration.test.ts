import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { authToken, inviteAndAcceptApprover } from "../test/factories.js";

describe("invitations (integration)", () => {
  let app: TestApp;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await authToken(app.client);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  describe("create", () => {
    it("forbids a non-admin from inviting", async () => {
      const { token: approver } = await inviteAndAcceptApprover(app.client, token);
      const res = await app.client.api.invitations.$post(
        { json: { name: "X", email: "x@example.com", role: "approver" } },
        authHeaders(approver),
      );
      expect(res.status).toBe(403);
    });

    it("creates a pending invitation carrying a token", async () => {
      const res = await app.client.api.invitations.$post(
        { json: { name: "Pat", email: "pat@example.com", role: "approver" } },
        authHeaders(token),
      );
      expect(res.status).toBe(201);
      const inv = await res.json();
      expect(inv.status).toBe("pending");
      expect(inv.email).toBe("pat@example.com");
      expect(inv.token.length).toBeGreaterThan(0);
    });

    it("rejects re-inviting the same email with 409", async () => {
      await app.client.api.invitations.$post(
        { json: { name: "Dup", email: "dup-inv@example.com", role: "approver" } },
        authHeaders(token),
      );
      const res = await app.client.api.invitations.$post(
        { json: { name: "Dup2", email: "dup-inv@example.com", role: "approver" } },
        authHeaders(token),
      );
      expect(res.status).toBe(409);
    });
  });

  describe("public preview + accept", () => {
    it("previews an invitation without auth, then accepts it and logs in", async () => {
      const inviteRes = await app.client.api.invitations.$post(
        { json: { name: "Robin", email: "robin@example.com", role: "approver" } },
        authHeaders(token),
      );
      const { token: inviteToken } = await inviteRes.json();

      // Preview is public (no bearer token).
      const previewRes = await app.client.api.invite[":token"].$get({
        param: { token: inviteToken },
      });
      expect(previewRes.status).toBe(200);
      const preview = await previewRes.json();
      expect(preview.email).toBe("robin@example.com");
      expect(preview.status).toBe("pending");
      expect(typeof preview.organizationName).toBe("string");

      // Accept activates the account and returns a session.
      const acceptRes = await app.client.api.invite.accept.$post({
        json: { token: inviteToken, password: "newpassword1" },
      });
      expect(acceptRes.status).toBe(200);
      const session = await acceptRes.json();
      expect(session.user.email).toBe("robin@example.com");
      expect(session.user.role).toBe("approver");
      expect(session.token.length).toBeGreaterThan(0);

      // The new approver can now log in directly.
      const loginRes = await app.client.api.auth.login.$post({
        json: { email: "robin@example.com", password: "newpassword1" },
      });
      expect(loginRes.status).toBe(200);
    });

    it("returns 404 for an unknown token", async () => {
      const res = await app.client.api.invite[":token"].$get({ param: { token: "nope" } });
      expect(res.status).toBe(404);
    });

    it("rejects accepting the same invitation twice with 409", async () => {
      const inviteRes = await app.client.api.invitations.$post(
        { json: { name: "Once", email: "once@example.com", role: "approver" } },
        authHeaders(token),
      );
      const { token: inviteToken } = await inviteRes.json();

      const first = await app.client.api.invite.accept.$post({
        json: { token: inviteToken, password: "password123" },
      });
      expect(first.status).toBe(200);

      const second = await app.client.api.invite.accept.$post({
        json: { token: inviteToken, password: "password123" },
      });
      expect(second.status).toBe(409);
    });

    it("cannot log in as a pending (un-accepted) invitee", async () => {
      await app.client.api.invitations.$post(
        { json: { name: "Ghost", email: "ghost@example.com", role: "approver" } },
        authHeaders(token),
      );
      // No password has been set yet — login must fail.
      const res = await app.client.api.auth.login.$post({
        json: { email: "ghost@example.com", password: "password123" },
      });
      expect(res.status).toBe(401);
    });
  });
});
