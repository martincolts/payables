import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { statsQuerySchema } from "@payables/shared";
import type { StatsService } from "../services/statsService.js";
import type { AuthEnv } from "../middleware/auth.js";

export function createStatsRoutes(service: StatsService) {
  return new Hono<AuthEnv>().get(
    "/dashboard",
    zValidator("query", statsQuerySchema),
    async (c) => {
      const result = await service.getDashboardStats(
        c.get("user").organizationId,
        c.req.valid("query"),
      );
      return c.json(result);
    },
  );
}
