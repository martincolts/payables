import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { bills } from "./bills.js";
import { users } from "./users.js";

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    .references(() => bills.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
