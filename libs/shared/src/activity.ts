import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

const isoDate = z.iso.date(); // "YYYY-MM-DD"

/**
 * Actions captured in the org-wide activity log. The set is closed (a Postgres
 * enum on the DB side) so a typo at the call site fails the type check rather
 * than silently writing a bad row.
 */
export const activityActions = [
  "bill_created",
  "bill_submitted",
  "bill_approved",
  "bill_rejected",
  "bill_deleted",
  "bill_paid",
  "bill_payment_failed",
  "vendor_created",
  "vendor_deactivated",
] as const;
export const activityActionSchema = z.enum(activityActions);
export type ActivityAction = z.infer<typeof activityActionSchema>;

/** Which kind of thing a log entry is about. */
export const activityEntityTypes = ["bill", "vendor"] as const;
export const activityEntityTypeSchema = z.enum(activityEntityTypes);
export type ActivityEntityType = z.infer<typeof activityEntityTypeSchema>;

/** Shape returned to clients. `userName` is joined for display. */
export const activityLogEntrySchema = z.object({
  id: z.uuid(),
  action: activityActionSchema,
  entityType: activityEntityTypeSchema,
  entityId: z.uuid(),
  userId: z.uuid(),
  userName: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type ActivityLogEntry = z.infer<typeof activityLogEntrySchema>;

/**
 * Query filters for the activity-log list endpoint. Combined with
 * {@link paginationQuerySchema} at the route — both `userId` and `action` are
 * independently optional.
 */
export const listActivityLogQuerySchema = z.object({
  userId: z.uuid().optional(),
  action: activityActionSchema.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type ListActivityLogQuery = z.infer<typeof listActivityLogQuerySchema> &
  z.infer<typeof paginationQuerySchema>;
