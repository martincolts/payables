import { z } from "zod";
import { billStatusSchema } from "./enums.js";

const isoDate = z.iso.date(); // "YYYY-MM-DD"

export const billLineItemSchema = z.object({
  id: z.uuid(),
  description: z.string().min(1),
  amount: z.string(), // NUMERIC(12,2) serialized as string to preserve precision
  category: z.string().nullable(),
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

/** A bill enriched with its vendor's name, as returned by the list endpoint. */
export const billListItemSchema = billSchema.extend({
  vendorName: z.string(),
});
export type BillListItem = z.infer<typeof billListItemSchema>;

export const createBillLineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "must be a money amount"),
  category: z.string().nullish(),
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
  search: z.string().optional(),
});
export type ListBillsQuery = z.infer<typeof listBillsQuerySchema>;
