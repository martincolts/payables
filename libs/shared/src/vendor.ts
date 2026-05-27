import { z } from "zod";
import { paymentMethodSchema } from "./enums.js";

export const vendorSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  paymentMethod: paymentMethodSchema,
  bankLast4: z.string().length(4).nullable(),
  createdAt: z.string(),
});
export type Vendor = z.infer<typeof vendorSchema>;

/** Request body for creating a vendor. */
export const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email(),
  paymentMethod: paymentMethodSchema,
  bankLast4: z.string().length(4).nullish(),
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const updateVendorSchema = createVendorSchema.partial();
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
