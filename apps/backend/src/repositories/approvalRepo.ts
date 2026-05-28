import { and, asc, eq, sql } from "drizzle-orm";
import type { Approval, ApprovalStatus } from "@payables/shared";
import { approvals, users } from "../db/schema/index.js";
import type { DB } from "../db/client.js";
import { ConflictError } from "../types/errors.js";
import { isUniqueViolation } from "../lib/pgErrors.js";

export type NewApproval = {
  billId: string;
  approverId: string;
  status: ApprovalStatus;
  comment: string | null;
};

/** Consumer-side interface: the slice of approval persistence services depend on. */
export type ApprovalRepo = {
  /** Records one approver's decision. Rejects a second vote by the same approver. */
  create(input: NewApproval): Promise<Approval>;
  listByBill(billId: string): Promise<Approval[]>;
  countApproved(billId: string): Promise<number>;
};

function toApproval(
  row: typeof approvals.$inferSelect,
  approverName: string,
): Approval {
  return {
    id: row.id,
    billId: row.billId,
    approverId: row.approverId,
    approverName,
    status: row.status as ApprovalStatus,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

export function createApprovalRepo(db: DB): ApprovalRepo {
  return {
    async create(input) {
      try {
        const [row] = await db
          .insert(approvals)
          .values({
            billId: input.billId,
            approverId: input.approverId,
            status: input.status,
            comment: input.comment,
            resolvedAt: new Date(),
          })
          .returning();
        const [approver] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, row!.approverId))
          .limit(1);
        return toApproval(row!, approver?.name ?? "");
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError("You have already recorded a decision on this bill");
        }
        throw err;
      }
    },

    async listByBill(billId) {
      const rows = await db
        .select({ approval: approvals, approverName: users.name })
        .from(approvals)
        .innerJoin(users, eq(approvals.approverId, users.id))
        .where(eq(approvals.billId, billId))
        .orderBy(asc(approvals.createdAt));
      return rows.map((r) => toApproval(r.approval, r.approverName));
    },

    async countApproved(billId) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(approvals)
        .where(and(eq(approvals.billId, billId), eq(approvals.status, "approved")));
      return row?.count ?? 0;
    },
  };
}
