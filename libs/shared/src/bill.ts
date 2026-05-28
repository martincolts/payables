import { z } from "zod";
import { approvalStatusSchema, billStatusSchema } from "./enums.js";

const isoDate = z.iso.date(); // "YYYY-MM-DD"

export const billLineItemSchema = z.object({
  id: z.uuid(),
  description: z.string().min(1),
  amount: z.string(), // NUMERIC(12,2) serialized as string to preserve precision
  glAccount: z.string().nullable(),
});
export type BillLineItem = z.infer<typeof billLineItemSchema>;

export const billSchema = z.object({
  id: z.uuid(),
  vendorId: z.uuid(),
  invoiceNumber: z.string().nullable(),
  amount: z.string(),
  currency: z.string().default("USD"),
  issueDate: isoDate,
  dueDate: isoDate,
  status: billStatusSchema,
  memo: z.string().nullable(),
  createdBy: z.uuid(),
  createdAt: z.string(),
});
export type Bill = z.infer<typeof billSchema>;

/** Compact approver info inlined on each list item for at-a-glance display. */
export const billApproverSchema = z.object({
  name: z.string(),
  status: approvalStatusSchema,
});
export type BillApprover = z.infer<typeof billApproverSchema>;

/** A bill enriched with its vendor's name and recorded approver decisions. */
export const billListItemSchema = billSchema.extend({
  vendorName: z.string(),
  approvers: z.array(billApproverSchema),
});
export type BillListItem = z.infer<typeof billListItemSchema>;

/** A single bill with its line items — returned by the detail endpoint. */
export const billDetailSchema = billListItemSchema.extend({
  lineItems: z.array(billLineItemSchema),
});
export type BillDetail = z.infer<typeof billDetailSchema>;

export const createBillLineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "must be a money amount"),
  glAccount: z.string().nullish(),
});

export const createBillSchema = z.object({
  vendorId: z.uuid(),
  invoiceNumber: z.string().max(100).nullish(),
  issueDate: isoDate,
  dueDate: isoDate,
  memo: z.string().max(1000).nullish(),
  lineItems: z.array(createBillLineItemSchema).min(1),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

/** Filters accepted by the bill list endpoint (merged with pagination). */
export const listBillsQuerySchema = z.object({
  status: billStatusSchema.optional(),
  vendorId: z.uuid().optional(),
  dueBefore: isoDate.optional(),
  dueAfter: isoDate.optional(),
  issueBefore: isoDate.optional(),
  issueAfter: isoDate.optional(),
  search: z.string().optional(),
  overdue: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true")
    .optional(),
});
export type ListBillsQuery = z.infer<typeof listBillsQuerySchema>;
