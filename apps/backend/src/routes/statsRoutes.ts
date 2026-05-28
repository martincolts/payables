import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { apAgingQuerySchema, statsQuerySchema } from "@payables/shared";
import type { StatsService } from "../services/statsService.js";
import { renderApAgingCsv } from "../services/apAgingCsv.js";
import type { AuthEnv } from "../middleware/auth.js";

export function createStatsRoutes(service: StatsService) {
  return new Hono<AuthEnv>()
    .get("/dashboard", zValidator("query", statsQuerySchema), async (c) => {
      const result = await service.getDashboardStats(
        c.get("user").organizationId,
        c.req.valid("query"),
      );
      return c.json(result);
    })
    .get("/ap-aging", zValidator("query", apAgingQuerySchema), async (c) => {
      const report = await service.getApAging(
        c.get("user").organizationId,
        c.req.valid("query"),
      );
      return c.json(report);
    })
    .get("/ap-aging.csv", zValidator("query", apAgingQuerySchema), async (c) => {
      const report = await service.getApAging(
        c.get("user").organizationId,
        c.req.valid("query"),
      );
      const csv = renderApAgingCsv(report);
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="ap-aging-${report.asOf}.csv"`,
        },
      });
    });
}
