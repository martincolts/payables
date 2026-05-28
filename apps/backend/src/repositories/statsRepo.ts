import { and, desc, eq, gte, sql } from "drizzle-orm";
import type {
  BillStatus,
  MonthlyStat,
  StatusStat,
  VendorStat,
} from "@payables/shared";
import type { DbExecutor } from "../db/client.js";
import { bills, vendors } from "../db/schema/index.js";

export type StatsRepo = {
  topVendorsByAmount(organizationId: string, limit?: number): Promise<VendorStat[]>;
  countsByStatus(organizationId: string): Promise<StatusStat[]>;
  monthlyTotals(organizationId: string, since: Date): Promise<MonthlyStat[]>;
};

export function createStatsRepo(db: DbExecutor): StatsRepo {
  return {
    async topVendorsByAmount(organizationId, limit = 8) {
      const rows = await db
        .select({
          vendorId: vendors.id,
          vendorName: vendors.name,
          billCount: sql<number>`count(${bills.id})::int`,
          totalAmount: sql<string>`coalesce(sum(${bills.amount}), 0)::text`,
        })
        .from(bills)
        .innerJoin(vendors, eq(bills.vendorId, vendors.id))
        .where(eq(bills.organizationId, organizationId))
        .groupBy(vendors.id, vendors.name)
        .orderBy(desc(sql`sum(${bills.amount})`))
        .limit(limit);
      return rows;
    },

    async countsByStatus(organizationId) {
      const rows = await db
        .select({
          status: bills.status,
          count: sql<number>`count(*)::int`,
          totalAmount: sql<string>`coalesce(sum(${bills.amount}), 0)::text`,
        })
        .from(bills)
        .where(eq(bills.organizationId, organizationId))
        .groupBy(bills.status);
      return rows as { status: BillStatus; count: number; totalAmount: string }[];
    },

    async monthlyTotals(organizationId, since) {
      // YYYY-MM-01 — date-only, parses as a local-date on the frontend.
      const sinceStr = since.toISOString().slice(0, 10);
      const rows = await db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${bills.issueDate}), 'YYYY-MM')`,
          billCount: sql<number>`count(*)::int`,
          totalAmount: sql<string>`coalesce(sum(${bills.amount}), 0)::text`,
        })
        .from(bills)
        .where(
          and(
            eq(bills.organizationId, organizationId),
            gte(bills.issueDate, sinceStr),
          ),
        )
        .groupBy(sql`date_trunc('month', ${bills.issueDate})`)
        .orderBy(sql`date_trunc('month', ${bills.issueDate}) asc`);
      return rows;
    },
  };
}
