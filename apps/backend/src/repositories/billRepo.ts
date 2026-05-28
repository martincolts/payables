import { and, asc, desc, eq, gte, ilike, inArray, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type {
  ApprovalStatus,
  BillApprover,
  BillListItem,
  BillStatus,
  CreateBillInput,
  ListBillsQuery,
  PaginationQuery,
} from "@payables/shared";
import type { DbExecutor } from "../db/client.js";
import { approvals, billLineItems, bills, users, vendors } from "../db/schema/index.js";
import { NotFoundError } from "../types/errors.js";

export type ListBillsParams = ListBillsQuery &
  PaginationQuery & { organizationId: string };

/** Consumer-side interface: the slice of bill persistence services depend on. */
export type BillRepo = {
  list(params: ListBillsParams): Promise<{ items: BillListItem[]; total: number }>;
  getById(id: string, organizationId: string): Promise<BillListItem>;
  /**
   * Inserts a bill and its line items in one transaction. The bill's total
   * `amount` is the sum of its line items. Returns the enriched list item.
   */
  create(
    input: CreateBillInput,
    createdBy: string,
    organizationId: string,
  ): Promise<BillListItem>;
  /** Sets a bill's status. Throws if the bill is unknown in the org. */
  updateStatus(
    id: string,
    organizationId: string,
    status: BillStatus,
  ): Promise<BillListItem>;
  /** Hard-deletes a bill; line items cascade. Throws if the bill is unknown. */
  delete(id: string, organizationId: string): Promise<void>;
};

/** Sums money strings ("12.34") exactly via integer cents. */
function sumAmounts(amounts: readonly string[]): string {
  const cents = amounts.reduce((acc, a) => acc + Math.round(Number(a) * 100), 0);
  return (cents / 100).toFixed(2);
}

type BillRow = typeof bills.$inferSelect;

function toBillListItem(
  row: BillRow,
  vendorName: string,
  approvers: BillApprover[],
): BillListItem {
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
    approvers,
  };
}

/** Loads approver name + decision per bill, grouped by bill id. */
async function loadApproversByBill(
  db: DbExecutor,
  billIds: readonly string[],
): Promise<Map<string, BillApprover[]>> {
  const grouped = new Map<string, BillApprover[]>();
  if (billIds.length === 0) return grouped;
  const rows = await db
    .select({ billId: approvals.billId, name: users.name, status: approvals.status })
    .from(approvals)
    .innerJoin(users, eq(approvals.approverId, users.id))
    .where(inArray(approvals.billId, billIds as string[]))
    .orderBy(asc(approvals.createdAt));
  for (const r of rows) {
    const list = grouped.get(r.billId) ?? [];
    list.push({ name: r.name, status: r.status as ApprovalStatus });
    grouped.set(r.billId, list);
  }
  return grouped;
}

export function createBillRepo(db: DbExecutor): BillRepo {
  return {
    async list({ organizationId, page, pageSize, status, vendorId, dueBefore, dueAfter, issueBefore, issueAfter, search, overdue }) {
      const offset = (page - 1) * pageSize;

      const conditions: SQL[] = [eq(bills.organizationId, organizationId)];
      if (status) conditions.push(eq(bills.status, status));
      if (vendorId) conditions.push(eq(bills.vendorId, vendorId));
      if (dueBefore) conditions.push(lte(bills.dueDate, dueBefore));
      if (dueAfter) conditions.push(gte(bills.dueDate, dueAfter));
      if (issueBefore) conditions.push(lte(bills.issueDate, issueBefore));
      if (issueAfter) conditions.push(gte(bills.issueDate, issueAfter));
      if (overdue) {
        conditions.push(ne(bills.status, "paid"));
        conditions.push(lt(bills.dueDate, sql`CURRENT_DATE`));
      }
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
          .orderBy(desc(bills.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bills)
          .innerJoin(vendors, eq(bills.vendorId, vendors.id))
          .where(where),
      ]);

      const approversByBill = await loadApproversByBill(
        db,
        rows.map((r) => r.bill.id),
      );

      return {
        items: rows.map((r) =>
          toBillListItem(r.bill, r.vendorName, approversByBill.get(r.bill.id) ?? []),
        ),
        total: count,
      };
    },

    async getById(id, organizationId) {
      const [row] = await db
        .select({ bill: bills, vendorName: vendors.name })
        .from(bills)
        .innerJoin(vendors, eq(bills.vendorId, vendors.id))
        .where(and(eq(bills.id, id), eq(bills.organizationId, organizationId)))
        .limit(1);
      if (!row) throw new NotFoundError("Bill", id);
      const approversByBill = await loadApproversByBill(db, [row.bill.id]);
      return toBillListItem(row.bill, row.vendorName, approversByBill.get(row.bill.id) ?? []);
    },

    async create(input, createdBy, organizationId) {
      const amount = sumAmounts(input.lineItems.map((li) => li.amount));

      const billId = await db.transaction(async (tx) => {
        const [bill] = await tx
          .insert(bills)
          .values({
            organizationId,
            vendorId: input.vendorId,
            invoiceNumber: input.invoiceNumber ?? null,
            amount,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            memo: input.memo ?? null,
            createdBy,
          })
          .returning({ id: bills.id });

        await tx.insert(billLineItems).values(
          input.lineItems.map((li) => ({
            billId: bill!.id,
            description: li.description,
            amount: li.amount,
            glAccount: li.glAccount ?? null,
          })),
        );
        return bill!.id;
      });

      return this.getById(billId, organizationId);
    },

    async updateStatus(id, organizationId, status) {
      const [row] = await db
        .update(bills)
        .set({ status })
        .where(and(eq(bills.id, id), eq(bills.organizationId, organizationId)))
        .returning({ id: bills.id });
      if (!row) throw new NotFoundError("Bill", id);
      return this.getById(id, organizationId);
    },

    async delete(id, organizationId) {
      const deleted = await db
        .delete(bills)
        .where(and(eq(bills.id, id), eq(bills.organizationId, organizationId)))
        .returning({ id: bills.id });
      if (deleted.length === 0) throw new NotFoundError("Bill", id);
    },
  };
}
