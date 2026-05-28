import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  listActivityLogQuerySchema,
  paginationQuerySchema,
} from "@payables/shared";
import type { ActivityLogService } from "../services/activityLogService.js";
import { requireAdmin, type AuthEnv } from "../middleware/auth.js";

const listQuerySchema = listActivityLogQuerySchema.extend(paginationQuerySchema.shape);

/**
 * Org-wide audit log. Admin-only — viewing who did what is part of the same
 * surface as Team and Settings.
 */
export function createActivityLogRoutes(service: ActivityLogService) {
  return new Hono<AuthEnv>().get(
    "/",
    requireAdmin,
    zValidator("query", listQuerySchema),
    async (c) => {
      const result = await service.list(
        c.get("user").organizationId,
        c.req.valid("query"),
      );
      return c.json(result);
    },
  );
}
