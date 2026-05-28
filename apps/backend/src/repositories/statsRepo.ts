import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type {
  BillStatus,
  MonthlyStat,
  StatusStat,
  VendorStat,
} from "@payables/shared";
import type { DbExecutor } from "../db/client.js";
import { bills, vendors } from "../db/schema/index.js";

export type VendorMonthlyRow = {
  vendorId: string;
  vendorName: string;
  month: string;
  totalAmount: string;
  billCount: number;
};

export type StatsRepo = {
  topVendorsByAmount(
    organizationId: string,
    since: Date,
    limit?: number,
  ): Promise<VendorStat[]>;
  countsByStatus(organizationId: string, since: Date): Promise<StatusStat[]>;
  monthlyTotals(organizationId: string, since: Date): Promise<MonthlyStat[]>;
  monthlyByVendor(
    organizationId: string,
    since: Date,
    vendorIds: string[],
  ): Promise<VendorMonthlyRow[]>;
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function createStatsRepo(db: DbExecutor): StatsRepo {
  return {
    async topVendorsByAmount(organizationId, since, limit = 8) {
      const rows = await db
        .select({
          vendorId: vendors.id,
          vendorName: vendors.name,
          billCount: sql<number>`count(${bills.id})::int`,
          totalAmount: sql<string>`coalesce(sum(${bills.amount}), 0)::text`,
        })
        .from(bills)
        .innerJoin(vendors, eq(bills.vendorId, vendors.id))
        .where(
          and(
            eq(bills.organizationId, organizationId),
            gte(bills.issueDate, toDateOnly(since)),
          ),
        )
        .groupBy(vendors.id, vendors.name)
        .orderBy(desc(sql`sum(${bills.amount})`))
        .limit(limit);
      return rows;
    },

    async countsByStatus(organizationId, since) {
      const rows = await db
        .select({
          status: bills.status,
          count: sql<number>`count(*)::int`,
          totalAmount: sql<string>`coalesce(sum(${bills.amount}), 0)::text`,
        })
        .from(bills)
        .where(
          and(
            eq(bills.organizationId, organizationId),
            gte(bills.issueDate, toDateOnly(since)),
          ),
        )
        .groupBy(bills.status);
      return rows as { status: BillStatus; count: number; totalAmount: string }[];
    },

    async monthlyTotals(organizationId, since) {
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
            gte(bills.issueDate, toDateOnly(since)),
          ),
        )
        .groupBy(sql`date_trunc('month', ${bills.issueDate})`)
        .orderBy(sql`date_trunc('month', ${bills.issueDate}) asc`);
      return rows;
    },

    async monthlyByVendor(organizationId, since, vendorIds) {
      if (vendorIds.length === 0) return [];
      const rows = await db
        .select({
          vendorId: vendors.id,
          vendorName: vendors.name,
          month: sql<string>`to_char(date_trunc('month', ${bills.issueDate}), 'YYYY-MM')`,
          billCount: sql<number>`count(*)::int`,
          totalAmount: sql<string>`coalesce(sum(${bills.amount}), 0)::text`,
        })
        .from(bills)
        .innerJoin(vendors, eq(bills.vendorId, vendors.id))
        .where(
          and(
            eq(bills.organizationId, organizationId),
            gte(bills.issueDate, toDateOnly(since)),
            inArray(vendors.id, vendorIds),
          ),
        )
        .groupBy(
          vendors.id,
          vendors.name,
          sql`date_trunc('month', ${bills.issueDate})`,
        )
        .orderBy(sql`date_trunc('month', ${bills.issueDate}) asc`);
      return rows;
    },
  };
}
