import {
  statsRangeToMonths,
  type DashboardStats,
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
      const months = statsRangeToMonths(query.range);
      const since = startOfMonthNMonthsAgo(months);

      const [topVendors, byStatus, monthly] = await Promise.all([
        repo.topVendorsByAmount(organizationId, since),
        repo.countsByStatus(organizationId, since),
        repo.monthlyTotals(organizationId, since),
      ]);

      const topIds = topVendors.slice(0, PER_VENDOR_TOP_N).map((v) => v.vendorId);
      const perVendorRows = await repo.monthlyByVendor(organizationId, since, topIds);

      return {
        topVendors,
        byStatus,
        monthly: zeroFillMonths(monthly, since, months),
        monthlyByVendor: pivotPerVendor(
          perVendorRows,
          topVendors.slice(0, PER_VENDOR_TOP_N).map((v) => ({
            vendorId: v.vendorId,
            vendorName: v.vendorName,
          })),
          since,
          months,
        ),
      };
    },
  };
}

function startOfMonthNMonthsAgo(months: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

function monthKeysFrom(from: Date, months: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function zeroFillMonths(
  rows: MonthlyStat[],
  from: Date,
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
  from: Date,
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
