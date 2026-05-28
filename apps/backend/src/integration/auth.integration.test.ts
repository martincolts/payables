import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test/testApp.js";
import { registerUser } from "../test/factories.js";

describe("auth (integration)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  describe("POST /api/auth/signup", () => {
    it("registers a user + org and returns a token + user (no password hash)", async () => {
      const res = await app.client.api.auth.signup.$post({
        json: {
          name: "Ada Lovelace",
          organizationName: "Analytical Engines",
          email: "ada@example.com",
          password: "password123",
        },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(typeof body.token).toBe("string");
      expect(body.token.length).toBeGreaterThan(0);
      expect(body.user).toMatchObject({
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "admin", // signup always creates an admin
      });
      expect(body.user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.user.organizationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.user).not.toHaveProperty("passwordHash");
    });

    it("rejects a duplicate email with 409", async () => {
      await registerUser(app.client, { email: "dup@example.com" });

      const res = await app.client.api.auth.signup.$post({
        json: {
          name: "Second",
          organizationName: "Another Org",
          email: "dup@example.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(409);
    });

    it("rejects an invalid body with 400", async () => {
      const res = await app.client.api.auth.signup.$post({
        // password too short, email malformed, org name missing
        json: { name: "Bad", organizationName: "", email: "not-an-email", password: "short" },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns a token for valid credentials", async () => {
      await registerUser(app.client, { email: "login-ok@example.com", password: "password123" });

      const res = await app.client.api.auth.login.$post({
        json: { email: "login-ok@example.com", password: "password123" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.token).toBe("string");
      expect(body.user.email).toBe("login-ok@example.com");
    });

    it("rejects a wrong password with 401", async () => {
      await registerUser(app.client, { email: "login-bad@example.com", password: "password123" });

      const res = await app.client.api.auth.login.$post({
        json: { email: "login-bad@example.com", password: "wrong-password" },
      });
      expect(res.status).toBe(401);
    });

    it("rejects an unknown email with 401", async () => {
      const res = await app.client.api.auth.login.$post({
        json: { email: "nobody@example.com", password: "password123" },
      });
      expect(res.status).toBe(401);
    });
  });
});
