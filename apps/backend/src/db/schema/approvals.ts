import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { bills } from "./bills.js";
import { users } from "./users.js";

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id),
    approverId: uuid("approver_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  // One decision per approver per bill — enforces the quorum counts cleanly.
  (t) => [uniqueIndex("approvals_bill_approver_unique").on(t.billId, t.approverId)],
);
