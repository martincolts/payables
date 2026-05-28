import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  paginationQuerySchema,
} from "@payables/shared";
import type { InvitationService } from "../services/invitationService.js";
import { requireAdmin, type AuthEnv } from "../middleware/auth.js";

/** Admin-only invitation management — mounted behind the auth gate. */
export function createInvitationRoutes(service: InvitationService) {
  return new Hono<AuthEnv>()
    .get("/", zValidator("query", paginationQuerySchema), async (c) => {
      const result = await service.list(
        c.get("user").organizationId,
        c.req.valid("query"),
      );
      return c.json(result);
    })
    .post("/", requireAdmin, zValidator("json", createInvitationSchema), async (c) => {
      const user = c.get("user");
      const invitation = await service.invite(
        c.req.valid("json"),
        user.organizationId,
        user.id,
      );
      return c.json(invitation, 201);
    });
}

/**
 * Public invitation endpoints (preview + accept) — mounted before the auth gate
 * so an invitee with no session can complete signup.
 */
export function createPublicInvitationRoutes(service: InvitationService) {
  return new Hono()
    .post("/accept", zValidator("json", acceptInvitationSchema), async (c) => {
      const result = await service.accept(c.req.valid("json"));
      return c.json(result);
    })
    .get("/:token", async (c) => {
      const preview = await service.preview(c.req.param("token"));
      return c.json(preview);
    });
}
