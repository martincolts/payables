import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { paginationQuerySchema, updateOrganizationSchema } from "@payables/shared";
import type { OrganizationService } from "../services/organizationService.js";
import { requireAdmin, type AuthEnv } from "../middleware/auth.js";

export function createOrganizationRoutes(service: OrganizationService) {
  return new Hono<AuthEnv>()
    .get("/", async (c) => {
      const org = await service.get(c.get("user").organizationId);
      return c.json(org);
    })
    .patch("/", requireAdmin, zValidator("json", updateOrganizationSchema), async (c) => {
      const org = await service.update(
        c.get("user").organizationId,
        c.req.valid("json"),
      );
      return c.json(org);
    })
    .get("/members", requireAdmin, zValidator("query", paginationQuerySchema), async (c) => {
      const result = await service.listMembers(
        c.get("user").organizationId,
        c.req.valid("query"),
      );
      return c.json(result);
    });
}
