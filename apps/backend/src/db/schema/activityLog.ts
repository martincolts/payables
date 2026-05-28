import { pgTable, uuid, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { activityActionEnum, activityEntityTypeEnum } from "./enums.js";
import { users } from "./users.js";
import { organizations } from "./organizations.js";

/**
 * Org-wide audit trail. One row per user-driven mutation across the app.
 *
 * The entity ref is intentionally generic (`entityType` + `entityId`) so the
 * same table can log bills, vendors, and anything we add next without a schema
 * change. Writes are co-transactional with the action being logged — see the
 * service layer.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    action: activityActionEnum("action").notNull(),
    entityType: activityEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The list endpoint always filters by org and orders by createdAt desc.
    index("activity_log_org_created_idx").on(t.organizationId, t.createdAt),
  ],
);
