import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { userStatusEnum } from "./enums.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  // Globally unique so login-by-email is unambiguous: a person belongs to one
  // org. (A multi-org membership model would scope this per-org and resolve the
  // org at login time — out of scope for the MVP.)
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Null until a pending invitee accepts and sets their password.
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("admin"), // admin | approver
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
