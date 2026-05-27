import { z } from "zod";

/** Bill lifecycle states. Transitions are enforced server-side in billService. */
export const billStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "paid",
] as const;
export const billStatusSchema = z.enum(billStatuses);
export type BillStatus = z.infer<typeof billStatusSchema>;

export const paymentMethods = ["ach", "wire", "check"] as const;
export const paymentMethodSchema = z.enum(paymentMethods);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const approvalStatuses = ["pending", "approved", "rejected"] as const;
export const approvalStatusSchema = z.enum(approvalStatuses);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const paymentStatuses = ["scheduled", "paid", "failed"] as const;
export const paymentStatusSchema = z.enum(paymentStatuses);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
