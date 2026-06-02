import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractedInvoiceSchema } from "@payables/shared";
import { createTestApp, type TestApp } from "../test/testApp.js";
import { approverToken, authToken } from "../test/factories.js";

/**
 * Builds a multipart request to POST /api/bills/extract. Uses the raw in-process
 * request (not the typed RPC client) because the endpoint takes a file upload.
 */
function extractRequest(opts: { token?: string; file?: File } = {}): Request {
  const form = new FormData();
  if (opts.file) {
    form.append("file", opts.file);
  }
  const headers: Record<string, string> = {};
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  return new Request("http://localhost/api/bills/extract", {
    method: "POST",
    headers,
    body: form,
  });
}

const sampleInvoice = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "invoice.pdf", {
    type: "application/pdf",
  });

describe("bills/extract (integration)", () => {
  let app: TestApp;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await authToken(app.client);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  it("returns canned, schema-valid extraction with a low-confidence field", async () => {
    const res = await app.request(extractRequest({ token, file: sampleInvoice() }));
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = extractedInvoiceSchema.parse(body); // throws on shape mismatch
    expect(parsed.mocked).toBe(true);
    expect(parsed.lineItems.length).toBeGreaterThan(0);

    // The mock seeds at least one field below the review threshold.
    const allConfidences = [
      parsed.vendorName.confidence,
      parsed.invoiceNumber.confidence,
      parsed.issueDate.confidence,
      parsed.dueDate.confidence,
      parsed.amount.confidence,
      ...parsed.lineItems.map((li) => li.confidence),
    ];
    expect(allConfidences.some((c) => c < 0.85)).toBe(true);
  });

  it("rejects a request with no file with 400", async () => {
    const res = await app.request(extractRequest({ token }));
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await app.request(extractRequest({ file: sampleInvoice() }));
    expect(res.status).toBe(401);
  });

  it("rejects a non-admin with 403", async () => {
    const approver = await approverToken(app);
    const res = await app.request(extractRequest({ token: approver, file: sampleInvoice() }));
    expect(res.status).toBe(403);
  });
});
