import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createVendorSchema,
  paginationQuerySchema,
} from "@payables/shared";
import type { VendorService } from "../services/vendorService.js";
import type { AuthEnv } from "../middleware/auth.js";

export function createVendorRoutes(service: VendorService) {
  return new Hono<AuthEnv>()
    .get("/", zValidator("query", paginationQuerySchema), async (c) => {
      const result = await service.list(c.req.valid("query"));
      return c.json(result);
    })
    .post("/", zValidator("json", createVendorSchema), async (c) => {
      const vendor = await service.create(c.req.valid("json"));
      return c.json(vendor, 201);
    })
    .get("/:id", async (c) => {
      const vendor = await service.getById(c.req.param("id"));
      return c.json(vendor);
    });
}
