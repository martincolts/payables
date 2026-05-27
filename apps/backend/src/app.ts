import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import type { Config } from "./config.js";
import type { DB } from "./db/client.js";
import { DomainError } from "./types/errors.js";
import { authMiddleware, type AuthEnv } from "./middleware/auth.js";
import { createVendorRepo } from "./repositories/vendorRepo.js";
import { createVendorService } from "./services/vendorService.js";
import { createVendorRoutes } from "./routes/vendorRoutes.js";
import { createUserRepo } from "./repositories/userRepo.js";
import { createAuthService } from "./services/authService.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createBillRepo } from "./repositories/billRepo.js";
import { createBillService } from "./services/billService.js";
import { createBillRoutes } from "./routes/billRoutes.js";

/**
 * Wires dependencies and builds the Hono app. The returned app's type is
 * exported as `AppType` and consumed by the frontend via Hono RPC (`hc`),
 * so the wire contract is inferred — never hand-duplicated.
 */
export function createApp(config: Config, db: DB) {
  const vendorService = createVendorService(createVendorRepo(db));
  const authService = createAuthService(createUserRepo(db), config.JWT_SECRET);
  const billService = createBillService(createBillRepo(db));

  const app = new Hono<AuthEnv>();

  app.use("*", logger());
  app.use("*", cors({ origin: config.CORS_ORIGIN, credentials: true }));

  app.get("/health", (c) => c.json({ status: "ok" as const }));

  const api = app
    .basePath("/api")
    // Public: authentication endpoints, registered before the auth gate.
    .route("/auth", createAuthRoutes(authService))
    // Everything below requires a valid bearer token.
    .use("*", authMiddleware(config.JWT_SECRET))
    .get("/me", (c) => c.json(c.get("user")))
    .route("/vendors", createVendorRoutes(vendorService))
    .route("/bills", createBillRoutes(billService));

  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json({ error: err.message }, err.status as 400);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return { app, api };
}

/** Route type used by the frontend RPC client. */
export type AppType = ReturnType<typeof createApp>["api"];
