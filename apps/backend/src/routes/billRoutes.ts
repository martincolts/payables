import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { listBillsQuerySchema, paginationQuerySchema } from "@payables/shared";
import type { BillService } from "../services/billService.js";
import type { AuthEnv } from "../middleware/auth.js";

const listQuerySchema = listBillsQuerySchema.extend(paginationQuerySchema.shape);

export function createBillRoutes(service: BillService) {
  return new Hono<AuthEnv>()
    .get("/", zValidator("query", listQuerySchema), async (c) => {
      const result = await service.list(c.req.valid("query"));
      return c.json(result);
    })
    .get("/:id", async (c) => {
      const bill = await service.getById(c.req.param("id"));
      return c.json(bill);
    });
}
