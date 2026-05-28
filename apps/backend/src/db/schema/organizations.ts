import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Quorum: how many distinct approvers must approve a bill before it can move
  // from pending_approval to approved.
  requiredApprovals: integer("required_approvals").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
