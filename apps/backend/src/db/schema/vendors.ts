import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { paymentMethodEnum } from "./enums.js";

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  bankLast4: text("bank_last4"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
