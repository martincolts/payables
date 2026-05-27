import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema, signupSchema } from "@payables/shared";
import type { AuthService } from "../services/authService.js";

/** Public auth endpoints — mounted before the auth middleware. */
export function createAuthRoutes(service: AuthService) {
  return new Hono()
    .post("/login", zValidator("json", loginSchema), async (c) => {
      const result = await service.login(c.req.valid("json"));
      return c.json(result);
    })
    .post("/signup", zValidator("json", signupSchema), async (c) => {
      const result = await service.signup(c.req.valid("json"));
      return c.json(result, 201);
    });
}
