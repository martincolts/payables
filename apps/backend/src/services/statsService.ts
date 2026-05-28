import {
  statsRangeToMonths,
  type DashboardStats,
  type MonthlyStat,
  type StatsQuery,
} from "@payables/shared";
import type { StatsRepo } from "../repositories/statsRepo.js";

export type StatsService = ReturnType<typeof createStatsService>;

export function createStatsService(repo: StatsRepo) {
  return {
    async getDashboardStats(
      organizationId: string,
      query: StatsQuery,
    ): Promise<DashboardStats> {
      const months = statsRangeToMonths(query.range);
      const since = startOfMonthNMonthsAgo(months);

      const [topVendors, byStatus, monthly] = await Promise.all([
        repo.topVendorsByAmount(organizationId),
        repo.countsByStatus(organizationId),
        repo.monthlyTotals(organizationId, since),
      ]);

      return {
        topVendors,
        byStatus,
        monthly: zeroFillMonths(monthly, since, months),
      };
    },
  };
}

/** First day of the month that is (months - 1) months before the current month. */
function startOfMonthNMonthsAgo(months: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

/** Returns a contiguous list of `months` MonthlyStat entries starting at `from`. */
function zeroFillMonths(
  rows: MonthlyStat[],
  from: Date,
  months: number,
): MonthlyStat[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: MonthlyStat[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push(byMonth.get(key) ?? { month: key, totalAmount: "0", billCount: 0 });
  }
  return out;
}
