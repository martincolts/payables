import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { billStatusEnum } from "./enums.js";
import { vendors } from "./vendors.js";
import { users } from "./users.js";
import { organizations } from "./organizations.js";

export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  invoiceNumber: text("invoice_number"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  status: billStatusEnum("status").notNull().default("draft"),
  memo: text("memo"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billLineItems = pgTable("bill_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    .references(() => bills.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  glAccount: text("gl_account"),
});
