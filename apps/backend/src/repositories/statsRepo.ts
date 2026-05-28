import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
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

export type SummaryRow = {
  totalOutstanding: string;
  overdueCount: number;
  pendingApprovalCount: number;
};

export type StatsRepo = {
  topVendorsByAmount(
    organizationId: string,
    since: Date,
    until: Date,
    limit?: number,
  ): Promise<VendorStat[]>;
  countsByStatus(
    organizationId: string,
    since: Date,
    until: Date,
  ): Promise<StatusStat[]>;
  monthlyTotals(
    organizationId: string,
    since: Date,
    until: Date,
  ): Promise<MonthlyStat[]>;
  monthlyByVendor(
    organizationId: string,
    since: Date,
    until: Date,
    vendorIds: string[],
  ): Promise<VendorMonthlyRow[]>;
  summary(
    organizationId: string,
    since: Date,
    until: Date,
    today: string,
  ): Promise<SummaryRow>;
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function createStatsRepo(db: DbExecutor): StatsRepo {
  return {
    async topVendorsByAmount(organizationId, since, until, limit = 8) {
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
            lt(bills.issueDate, toDateOnly(until)),
          ),
        )
        .groupBy(vendors.id, vendors.name)
        .orderBy(desc(sql`sum(${bills.amount})`))
        .limit(limit);
      return rows;
    },

    async countsByStatus(organizationId, since, until) {
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
            lt(bills.issueDate, toDateOnly(until)),
          ),
        )
        .groupBy(bills.status);
      return rows as { status: BillStatus; count: number; totalAmount: string }[];
    },

    async monthlyTotals(organizationId, since, until) {
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
            lt(bills.issueDate, toDateOnly(until)),
          ),
        )
        .groupBy(sql`date_trunc('month', ${bills.issueDate})`)
        .orderBy(sql`date_trunc('month', ${bills.issueDate}) asc`);
      return rows;
    },

    async summary(organizationId, since, until, today) {
      const [row] = await db
        .select({
          totalOutstanding: sql<string>`coalesce(sum(${bills.amount}) filter (where ${bills.status} <> 'paid'), 0)::text`,
          overdueCount: sql<number>`count(*) filter (where ${bills.status} <> 'paid' and ${bills.dueDate} < ${today})::int`,
          pendingApprovalCount: sql<number>`count(*) filter (where ${bills.status} = 'pending_approval')::int`,
        })
        .from(bills)
        .where(
          and(
            eq(bills.organizationId, organizationId),
            gte(bills.issueDate, toDateOnly(since)),
            lt(bills.issueDate, toDateOnly(until)),
          ),
        );
      return (
        row ?? { totalOutstanding: "0", overdueCount: 0, pendingApprovalCount: 0 }
      );
    },

    async monthlyByVendor(organizationId, since, until, vendorIds) {
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
            lt(bills.issueDate, toDateOnly(until)),
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
