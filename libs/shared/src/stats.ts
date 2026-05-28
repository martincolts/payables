import { z } from "zod";
import { billStatusSchema } from "./enums.js";

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");
export type MonthKey = z.infer<typeof monthKeySchema>;

export const statsQuerySchema = z
  .object({
    from: monthKeySchema.optional(),
    to: monthKeySchema.optional(),
  })
  .refine((q) => !(q.from && q.to) || q.from <= q.to, {
    message: "from must be <= to",
    path: ["from"],
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

export const vendorMonthlySeriesSchema = z.object({
  vendorId: z.string(),
  vendorName: z.string(),
  points: z.array(monthlyStatSchema),
});
export type VendorMonthlySeries = z.infer<typeof vendorMonthlySeriesSchema>;

export const dashboardSummarySchema = z.object({
  totalOutstanding: z.string(),
  overdueCount: z.number().int(),
  pendingApprovalCount: z.number().int(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const dashboardStatsSchema = z.object({
  summary: dashboardSummarySchema,
  topVendors: z.array(vendorStatSchema),
  byStatus: z.array(statusStatSchema),
  monthly: z.array(monthlyStatSchema),
  monthlyByVendor: z.array(vendorMonthlySeriesSchema),
  from: monthKeySchema,
  to: monthKeySchema,
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm) + 1;
}

export function defaultStatsWindow(now: Date = new Date()): {
  from: MonthKey;
  to: MonthKey;
} {
  const to = currentMonthKey(now);
  return { from: addMonths(to, -11), to };
}
