import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createBillSchema,
  listBillsQuerySchema,
  paginationQuerySchema,
  submitApprovalSchema,
} from "@payables/shared";
import type { BillService } from "../services/billService.js";
import type { ApprovalService } from "../services/approvalService.js";
import type { ExtractionService } from "../services/extractionService.js";
import { requireAdmin, requireApprover, type AuthEnv } from "../middleware/auth.js";
import { BadRequestError } from "../types/errors.js";

const listQuerySchema = listBillsQuerySchema.extend(paginationQuerySchema.shape);

export function createBillRoutes(
  service: BillService,
  approvalService: ApprovalService,
  extractionService: ExtractionService,
) {
  return new Hono<AuthEnv>()
    .get("/", zValidator("query", listQuerySchema), async (c) => {
      const result = await service.list({
        ...c.req.valid("query"),
        organizationId: c.get("user").organizationId,
      });
      return c.json(result);
    })
    .post("/", requireAdmin, zValidator("json", createBillSchema), async (c) => {
      const user = c.get("user");
      const bill = await service.create(c.req.valid("json"), user.id, user.organizationId);
      return c.json(bill, 201);
    })
    // Mocked invoice ingestion: accepts an uploaded file (not persisted) and
    // returns canned structured fields the frontend uses to pre-fill the form.
    .post("/extract", requireAdmin, async (c) => {
      const body = await c.req.parseBody();
      const file = body["file"];
      if (!(file instanceof File)) {
        throw new BadRequestError("An invoice file is required");
      }
      const extracted = await extractionService.extract(file);
      return c.json(extracted, 200);
    })
    .get("/:id", async (c) => {
      const bill = await service.getById(c.req.param("id"), c.get("user").organizationId);
      return c.json(bill);
    })
    .post("/:id/submit", requireAdmin, async (c) => {
      const user = c.get("user");
      const bill = await service.submitForApproval(
        c.req.param("id"),
        user.organizationId,
        user.id,
      );
      return c.json(bill);
    })
    .post("/:id/simulate-payment", requireAdmin, async (c) => {
      const user = c.get("user");
      const bill = await service.simulatePayment(
        c.req.param("id"),
        user.organizationId,
        user.id,
      );
      return c.json(bill);
    })
    .post("/:id/simulate-payment-failure", requireAdmin, async (c) => {
      const user = c.get("user");
      const bill = await service.simulatePaymentFailure(
        c.req.param("id"),
        user.organizationId,
        user.id,
      );
      return c.json(bill);
    })
    .get("/:id/approvals", async (c) => {
      const summary = await approvalService.getSummary(
        c.req.param("id"),
        c.get("user").organizationId,
      );
      return c.json(summary);
    })
    .post(
      "/:id/approvals",
      requireApprover,
      zValidator("json", submitApprovalSchema),
      async (c) => {
        const user = c.get("user");
        const summary = await approvalService.submitDecision(
          c.req.param("id"),
          user.organizationId,
          user.id,
          c.req.valid("json"),
        );
        return c.json(summary, 201);
      },
    )
    .delete("/:id", requireAdmin, async (c) => {
      const user = c.get("user");
      await service.remove(c.req.param("id"), user.organizationId, user.id);
      return c.body(null, 204);
    });
}
