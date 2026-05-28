import { randomUUID } from "node:crypto";
import type {
  AuthResponse,
  BillListItem,
  CreateBillInput,
  PaymentMethod,
  Vendor,
} from "@payables/shared";
import { authHeaders, type TestApp, type TestClient } from "./testApp.js";

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

/**
 * Registers a brand-new user — which also creates their organization, with the
 * user as its first admin — and returns the auth response (token + user).
 */
export async function registerUser(
  client: TestClient,
  overrides: {
    name?: string;
    organizationName?: string;
    email?: string;
    password?: string;
  } = {},
): Promise<AuthResponse> {
  const res = await client.api.auth.signup.$post({
    json: {
      name: overrides.name ?? "Test User",
      organizationName: overrides.organizationName ?? `Org ${randomUUID().slice(0, 8)}`,
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

/**
 * Invites an approver into the admin's organization and accepts the invitation,
 * returning the new approver's session (token + user). This is the only path to
 * an approver — they always join an existing org via invitation.
 */
export async function inviteAndAcceptApprover(
  client: TestClient,
  adminToken: string,
  overrides: { name?: string; email?: string; password?: string } = {},
): Promise<AuthResponse> {
  const email = overrides.email ?? `approver-${randomUUID()}@example.com`;
  const password = overrides.password ?? "password123";

  const inviteRes = await client.api.invitations.$post(
    { json: { name: overrides.name ?? "Approver", email, role: "approver" } },
    authHeaders(adminToken),
  );
  if (inviteRes.status !== 201) {
    throw new Error(`invite failed: ${inviteRes.status} ${await inviteRes.text()}`);
  }
  const { token } = await inviteRes.json();

  const acceptRes = await client.api.invite.accept.$post({ json: { token, password } });
  if (acceptRes.status !== 200) {
    throw new Error(`accept failed: ${acceptRes.status} ${await acceptRes.text()}`);
  }
  return acceptRes.json();
}

/**
 * Returns a token for an approver in a *separate* organization — enough to
 * exercise the admin gate (role check), where the org doesn't matter.
 */
export async function approverToken(app: TestApp): Promise<string> {
  const { token: adminToken } = await registerUser(app.client);
  const { token } = await inviteAndAcceptApprover(app.client, adminToken);
  return token;
}

/** Creates a bill as an authenticated (admin) caller and returns it. */
export async function createBill(
  client: TestClient,
  token: string,
  vendorId: string,
  overrides: Partial<CreateBillInput> = {},
): Promise<BillListItem> {
  const res = await client.api.bills.$post(
    {
      json: {
        vendorId,
        invoiceNumber: overrides.invoiceNumber ?? `INV-${randomUUID().slice(0, 8)}`,
        issueDate: overrides.issueDate ?? "2026-01-01",
        dueDate: overrides.dueDate ?? "2026-02-01",
        memo: overrides.memo,
        lineItems: overrides.lineItems ?? [{ description: "Services", amount: "100.00" }],
      },
    },
    authHeaders(token),
  );
  if (res.status !== 201) {
    throw new Error(`createBill failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
