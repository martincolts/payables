import { z } from "zod";
import { billStatusSchema } from "./enums.js";

export const statsRanges = ["6m", "12m", "24m"] as const;
export const statsRangeSchema = z.enum(statsRanges);
export type StatsRange = z.infer<typeof statsRangeSchema>;

export const statsQuerySchema = z.object({
  range: statsRangeSchema.default("12m"),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const vendorStatSchema = z.object({
  vendorId: z.uuid(),
  vendorName: z.string(),
  billCount: z.number().int(),
  totalAmount: z.string(),
});
export type VendorStat = z.infer<typeof vendorStatSchema>;

export const statusStatSchema = z.object({
  status: billStatusSchema,
  count: z.number().int(),
  totalAmount: z.string(),
});
export type StatusStat = z.infer<typeof statusStatSchema>;

export const monthlyStatSchema = z.object({
  month: z.string(),
  totalAmount: z.string(),
  billCount: z.number().int(),
});
export type MonthlyStat = z.infer<typeof monthlyStatSchema>;

export const dashboardStatsSchema = z.object({
  topVendors: z.array(vendorStatSchema),
  byStatus: z.array(statusStatSchema),
  monthly: z.array(monthlyStatSchema),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export function statsRangeToMonths(range: StatsRange): number {
  return range === "6m" ? 6 : range === "24m" ? 24 : 12;
}
