import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createBillSchema,
  listBillsQuerySchema,
  paginationQuerySchema,
} from "@payables/shared";
import type { BillService } from "../services/billService.js";
import { requireAdmin, type AuthEnv } from "../middleware/auth.js";

const listQuerySchema = listBillsQuerySchema.extend(paginationQuerySchema.shape);

export function createBillRoutes(service: BillService) {
  return new Hono<AuthEnv>()
    .get("/", zValidator("query", listQuerySchema), async (c) => {
      const result = await service.list(c.req.valid("query"));
      return c.json(result);
    })
    .post("/", requireAdmin, zValidator("json", createBillSchema), async (c) => {
      const bill = await service.create(c.req.valid("json"), c.get("user").id);
      return c.json(bill, 201);
    })
    .get("/:id", async (c) => {
      const bill = await service.getById(c.req.param("id"));
      return c.json(bill);
    })
    .delete("/:id", requireAdmin, async (c) => {
      await service.remove(c.req.param("id"));
      return c.body(null, 204);
    });
}
