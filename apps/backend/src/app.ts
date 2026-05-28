import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import type { Config } from "./config.js";
import type { DB } from "./db/client.js";
import { DomainError } from "./types/errors.js";
import { authMiddleware, type AuthEnv } from "./middleware/auth.js";
import { createVendorService } from "./services/vendorService.js";
import { createVendorRoutes } from "./routes/vendorRoutes.js";
import { createUserRepo } from "./repositories/userRepo.js";
import { createOrganizationRepo } from "./repositories/organizationRepo.js";
import { createAuthService } from "./services/authService.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createBillService } from "./services/billService.js";
import { createBillRoutes } from "./routes/billRoutes.js";
import { createApprovalService } from "./services/approvalService.js";
import { createInvitationRepo } from "./repositories/invitationRepo.js";
import { createInvitationService } from "./services/invitationService.js";
import {
  createInvitationRoutes,
  createPublicInvitationRoutes,
} from "./routes/invitationRoutes.js";
import { createOrganizationService } from "./services/organizationService.js";
import { createOrganizationRoutes } from "./routes/organizationRoutes.js";
import { createActivityLogRepo } from "./repositories/activityLogRepo.js";
import { createActivityLogService } from "./services/activityLogService.js";
import { createActivityLogRoutes } from "./routes/activityLogRoutes.js";

/**
 * Wires dependencies and builds the Hono app. The returned app's type is
 * exported as `AppType` and consumed by the frontend via Hono RPC (`hc`),
 * so the wire contract is inferred — never hand-duplicated.
 */
export function createApp(config: Config, db: DB) {
  const vendorService = createVendorService(db);
  const userRepo = createUserRepo(db);
  const orgRepo = createOrganizationRepo(db);
  const authService = createAuthService(userRepo, orgRepo, config.JWT_SECRET);
  const billService = createBillService(db);
  const approvalService = createApprovalService(db, orgRepo);
  const invitationService = createInvitationService(
    createInvitationRepo(db),
    userRepo,
    config.JWT_SECRET,
  );
  const organizationService = createOrganizationService(orgRepo, userRepo);
  const activityLogService = createActivityLogService(createActivityLogRepo(db));

  const app = new Hono<AuthEnv>();

  app.use("*", logger());
  app.use("*", cors({ origin: config.CORS_ORIGIN, credentials: true }));

  app.get("/health", (c) => c.json({ status: "ok" as const }));

  const api = app
    .basePath("/api")
    // Public: authentication + invitation-acceptance, before the auth gate.
    .route("/auth", createAuthRoutes(authService))
    .route("/invite", createPublicInvitationRoutes(invitationService))
    // Everything below requires a valid bearer token.
    .use("*", authMiddleware(config.JWT_SECRET))
    .get("/me", (c) => c.json(c.get("user")))
    .route("/organization", createOrganizationRoutes(organizationService))
    .route("/invitations", createInvitationRoutes(invitationService))
    .route("/vendors", createVendorRoutes(vendorService))
    .route("/bills", createBillRoutes(billService, approvalService))
    .route("/activity-log", createActivityLogRoutes(activityLogService));

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
