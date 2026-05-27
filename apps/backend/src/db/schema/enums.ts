import { pgEnum } from "drizzle-orm/pg-core";
import {
  billStatuses,
  paymentMethods,
} from "@payables/shared";

export const billStatusEnum = pgEnum("bill_status", billStatuses);
export const paymentMethodEnum = pgEnum("payment_method", paymentMethods);
