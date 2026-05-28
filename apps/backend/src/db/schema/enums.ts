import { pgEnum } from "drizzle-orm/pg-core";
import {
  activityActions,
  activityEntityTypes,
  billStatuses,
  invitationStatuses,
  paymentMethods,
  userStatuses,
} from "@payables/shared";

export const billStatusEnum = pgEnum("bill_status", billStatuses);
export const paymentMethodEnum = pgEnum("payment_method", paymentMethods);
export const userStatusEnum = pgEnum("user_status", userStatuses);
export const invitationStatusEnum = pgEnum("invitation_status", invitationStatuses);
export const activityActionEnum = pgEnum("activity_action", activityActions);
export const activityEntityTypeEnum = pgEnum("activity_entity_type", activityEntityTypes);
