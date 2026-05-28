import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { invitationStatusEnum } from "./enums.js";

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    // The pending user this invitation will activate on acceptance.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    email: text("email").notNull(),
    role: text("role").notNull().default("approver"), // admin | approver
    // Opaque random token. In a real app this would be emailed as a link; here
    // the admin surfaces it in the UI for the invitee to accept (see README).
    token: text("token").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("invitations_org_email_unique").on(t.organizationId, t.email)],
);
