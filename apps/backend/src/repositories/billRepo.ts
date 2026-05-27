import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { BillListItem, ListBillsQuery, PaginationQuery } from "@payables/shared";
import type { DB } from "../db/client.js";
import { bills, vendors } from "../db/schema/index.js";
import { NotFoundError } from "../types/errors.js";

export type ListBillsParams = ListBillsQuery & PaginationQuery;

/** Consumer-side interface: the slice of bill persistence services depend on. */
export type BillRepo = {
  list(params: ListBillsParams): Promise<{ items: BillListItem[]; total: number }>;
  getById(id: string): Promise<BillListItem>;
};

type BillRow = typeof bills.$inferSelect;

function toBillListItem(row: BillRow, vendorName: string): BillListItem {
  return {
    id: row.id,
    vendorId: row.vendorId,
    invoiceNumber: row.invoiceNumber,
    amount: row.amount,
    currency: row.currency,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    status: row.status,
    memo: row.memo,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    vendorName,
  };
}

export function createBillRepo(db: DB): BillRepo {
  return {
    async list({ page, pageSize, status, vendorId, dueBefore, dueAfter, search }) {
      const offset = (page - 1) * pageSize;

      const conditions: SQL[] = [];
      if (status) conditions.push(eq(bills.status, status));
      if (vendorId) conditions.push(eq(bills.vendorId, vendorId));
      if (dueBefore) conditions.push(lte(bills.dueDate, dueBefore));
      if (dueAfter) conditions.push(gte(bills.dueDate, dueAfter));
      if (search) {
        const term = `%${search}%`;
        conditions.push(
          or(ilike(bills.invoiceNumber, term), ilike(vendors.name, term))!,
        );
      }
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [{ count } = { count: 0 }]] = await Promise.all([
        db
          .select({ bill: bills, vendorName: vendors.name })
          .from(bills)
          .innerJoin(vendors, eq(bills.vendorId, vendors.id))
          .where(where)
          .orderBy(asc(bills.dueDate), desc(bills.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bills)
          .innerJoin(vendors, eq(bills.vendorId, vendors.id))
          .where(where),
      ]);

      return {
        items: rows.map((r) => toBillListItem(r.bill, r.vendorName)),
        total: count,
      };
    },

    async getById(id) {
      const [row] = await db
        .select({ bill: bills, vendorName: vendors.name })
        .from(bills)
        .innerJoin(vendors, eq(bills.vendorId, vendors.id))
        .where(eq(bills.id, id))
        .limit(1);
      if (!row) throw new NotFoundError("Bill", id);
      return toBillListItem(row.bill, row.vendorName);
    },
  };
}
