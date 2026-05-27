import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { registerUser } from "../test/factories.js";

describe("auth gate + /api/me (integration)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  it("returns the authenticated user for a valid token", async () => {
    const { token, user } = await registerUser(app.client, { email: "me@example.com" });

    const res = await app.client.api.me.$get(undefined, authHeaders(token));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: user.id, email: "me@example.com", role: "admin" });
  });

  it("rejects a request with no bearer token (401)", async () => {
    const res = await app.client.api.me.$get();
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token (401)", async () => {
    const res = await app.client.api.me.$get(undefined, authHeaders("not-a-real-jwt"));
    expect(res.status).toBe(401);
  });
});
