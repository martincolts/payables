import { z } from "zod";

export const AP_AGING_BUCKETS = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
] as const;
export type ApAgingBucket = (typeof AP_AGING_BUCKETS)[number];

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const apAgingQuerySchema = z.object({
  asOf: isoDateSchema.optional(),
});
export type ApAgingQuery = z.infer<typeof apAgingQuerySchema>;

const bucketAmountsSchema = z.object({
  current: z.string(),
  d1_30: z.string(),
  d31_60: z.string(),
  d61_90: z.string(),
  d90_plus: z.string(),
});
export type ApAgingBucketAmounts = z.infer<typeof bucketAmountsSchema>;

export const apAgingVendorRowSchema = z.object({
  vendorId: z.string().uuid(),
  vendorName: z.string(),
  buckets: bucketAmountsSchema,
  total: z.string(),
});
export type ApAgingVendorRow = z.infer<typeof apAgingVendorRowSchema>;

export const apAgingReportSchema = z.object({
  asOf: isoDateSchema,
  rows: z.array(apAgingVendorRowSchema),
  totals: z.object({
    buckets: bucketAmountsSchema,
    total: z.string(),
  }),
});
export type ApAgingReport = z.infer<typeof apAgingReportSchema>;
