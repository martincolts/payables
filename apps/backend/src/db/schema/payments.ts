import {
  pgTable,
  uuid,
  numeric,
  text,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { paymentMethodEnum } from "./enums.js";
import { bills } from "./bills.js";

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    .unique()
    .references(() => bills.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  referenceNumber: text("reference_number"),
  scheduledDate: date("scheduled_date"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: text("status").notNull().default("scheduled"), // scheduled | paid | failed
});
