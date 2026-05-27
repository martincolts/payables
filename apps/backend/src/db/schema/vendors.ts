import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { paymentMethodEnum } from "./enums.js";

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  bankLast4: text("bank_last4"),
  // Soft-delete flag: deactivated vendors are hidden from lists and the
  // bill-creation picker, but their existing bills keep referencing them.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
