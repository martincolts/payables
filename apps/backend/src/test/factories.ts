import { randomUUID } from "node:crypto";
import type { AuthResponse, PaymentMethod, Vendor } from "@payables/shared";
import { authHeaders, type TestClient } from "./testApp.js";

/**
 * Test data factories that build state **only through the public API** — the
 * same path a real client takes. Creating a user means actually registering
 * one; creating a vendor means POSTing it as an authenticated caller. This
 * keeps integration tests honest: if an endpoint's contract breaks, setup
 * breaks too, instead of side-stepping it with direct DB inserts.
 *
 * Each factory generates unique values by default (so suites don't collide on
 * unique constraints) and accepts overrides for the fields a test cares about.
 */

/** Registers a brand-new user and returns the auth response (token + user). */
export async function registerUser(
  client: TestClient,
  overrides: { name?: string; email?: string; password?: string } = {},
): Promise<AuthResponse> {
  const res = await client.api.auth.signup.$post({
    json: {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user-${randomUUID()}@example.com`,
      password: overrides.password ?? "password123",
    },
  });
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Registers a user and returns just their bearer token — the common case when
 * a test only needs an authenticated caller, not the user record.
 */
export async function authToken(
  client: TestClient,
  overrides?: { name?: string; email?: string; password?: string },
): Promise<string> {
  const { token } = await registerUser(client, overrides);
  return token;
}

/** Creates a vendor as an authenticated caller and returns it. */
export async function createVendor(
  client: TestClient,
  token: string,
  overrides: {
    name?: string;
    email?: string;
    paymentMethod?: PaymentMethod;
    bankLast4?: string | null;
  } = {},
): Promise<Vendor> {
  const res = await client.api.vendors.$post(
    {
      json: {
        name: overrides.name ?? `Vendor ${randomUUID().slice(0, 8)}`,
        email: overrides.email ?? `vendor-${randomUUID()}@example.com`,
        paymentMethod: overrides.paymentMethod ?? "ach",
        bankLast4: overrides.bankLast4 ?? null,
      },
    },
    authHeaders(token),
  );
  if (res.status !== 201) {
    throw new Error(`createVendor failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
