import {
  addMonths,
  defaultStatsWindow,
  monthsBetween,
  type BillStatus,
  type DashboardStats,
  type MonthKey,
  type MonthlyStat,
  type StatsQuery,
  type VendorMonthlySeries,
} from "@payables/shared";
import type { StatsRepo, VendorMonthlyRow } from "../repositories/statsRepo.js";

export type StatsService = ReturnType<typeof createStatsService>;

const PER_VENDOR_TOP_N = 5;

export function createStatsService(repo: StatsRepo) {
  return {
    async getDashboardStats(
      organizationId: string,
      query: StatsQuery,
    ): Promise<DashboardStats> {
      const { from, to } = resolveWindow(query);
      const months = monthsBetween(from, to);
      const since = monthKeyToDate(from);
      const until = monthKeyToDate(addMonths(to, 1));
      const statuses: BillStatus[] = query.statuses ?? [];
      const hasStatusFilter = statuses.length > 0;

      const today = new Date().toISOString().slice(0, 10);
      const [topVendors, byStatus, monthly, summary] = await Promise.all([
        repo.topVendorsByAmount(organizationId, since, until, undefined, statuses),
        repo.countsByStatus(organizationId, since, until),
        repo.monthlyTotals(organizationId, since, until, statuses),
        repo.summary(organizationId, since, until, today),
      ]);

      const topIds = topVendors.slice(0, PER_VENDOR_TOP_N).map((v) => v.vendorId);
      const [perVendorRows, topVendorsByStatus, monthlyByStatus] = await Promise.all([
        repo.monthlyByVendor(organizationId, since, until, topIds, statuses),
        hasStatusFilter
          ? repo.topVendorsByStatus(
              organizationId,
              since,
              until,
              topVendors.map((v) => v.vendorId),
              statuses,
            )
          : Promise.resolve([]),
        hasStatusFilter
          ? repo.monthlyByStatus(organizationId, since, until, statuses)
          : Promise.resolve([]),
      ]);

      return {
        summary,
        topVendors,
        byStatus,
        monthly: zeroFillMonths(monthly, from, months),
        monthlyByVendor: pivotPerVendor(
          perVendorRows,
          topVendors.slice(0, PER_VENDOR_TOP_N).map((v) => ({
            vendorId: v.vendorId,
            vendorName: v.vendorName,
          })),
          from,
          months,
        ),
        topVendorsByStatus,
        monthlyByStatus,
        appliedStatuses: statuses,
        from,
        to,
      };
    },
  };
}

function resolveWindow(query: StatsQuery): { from: MonthKey; to: MonthKey } {
  const defaults = defaultStatsWindow();
  const to = query.to ?? defaults.to;
  const from = query.from ?? (query.to ? addMonths(to, -11) : defaults.from);
  return { from, to };
}

function monthKeyToDate(key: MonthKey): Date {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1));
}

function monthKeysFrom(from: MonthKey, months: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < months; i++) keys.push(addMonths(from, i));
  return keys;
}

function zeroFillMonths(
  rows: MonthlyStat[],
  from: MonthKey,
  months: number,
): MonthlyStat[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return monthKeysFrom(from, months).map(
    (key) => byMonth.get(key) ?? { month: key, totalAmount: "0", billCount: 0 },
  );
}

function pivotPerVendor(
  rows: VendorMonthlyRow[],
  vendors: { vendorId: string; vendorName: string }[],
  from: MonthKey,
  months: number,
): VendorMonthlySeries[] {
  const keys = monthKeysFrom(from, months);
  const byVendor = new Map<string, Map<string, VendorMonthlyRow>>();
  for (const r of rows) {
    let inner = byVendor.get(r.vendorId);
    if (!inner) {
      inner = new Map();
      byVendor.set(r.vendorId, inner);
    }
    inner.set(r.month, r);
  }
  return vendors.map((v) => {
    const inner = byVendor.get(v.vendorId);
    const points = keys.map((key) => {
      const hit = inner?.get(key);
      return hit
        ? { month: key, totalAmount: hit.totalAmount, billCount: hit.billCount }
        : { month: key, totalAmount: "0", billCount: 0 };
    });
    return { vendorId: v.vendorId, vendorName: v.vendorName, points };
  });
}
