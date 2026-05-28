import type { BillDetail, BillListItem, CreateBillInput, Paginated } from "@payables/shared";
import type { DB } from "../db/client.js";
import {
  createBillRepo,
  type BillRepo,
  type ListBillsParams,
} from "../repositories/billRepo.js";
import { createVendorRepo } from "../repositories/vendorRepo.js";
import { createActivityLogRepo } from "../repositories/activityLogRepo.js";
import { assertTransition } from "./billStateMachine.js";
import { ConflictError } from "../types/errors.js";

export type BillService = ReturnType<typeof createBillService>;

/**
 * Bill operations. Mutations are wrapped in a transaction with their matching
 * activity-log write so the audit trail can't drift from the data.
 */
export function createBillService(db: DB) {
  const repo: BillRepo = createBillRepo(db);
  const vendorRepo = createVendorRepo(db);

  return {
    getById(id: string, organizationId: string): Promise<BillDetail> {
      return repo.getById(id, organizationId);
    },

    async list(params: ListBillsParams): Promise<Paginated<BillListItem>> {
      const { items, total } = await repo.list(params);
      return {
        items,
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      };
    },

    async create(
      input: CreateBillInput,
      createdBy: string,
      organizationId: string,
    ): Promise<BillDetail> {
      // Reject bills against unknown or deactivated vendors. getById throws
      // NotFoundError (→ 404) when the vendor doesn't exist.
      const vendor = await vendorRepo.getById(input.vendorId, organizationId);
      if (!vendor.isActive) {
        throw new ConflictError("Cannot create a bill for a deactivated vendor");
      }
      return db.transaction(async (tx) => {
        const bill = await createBillRepo(tx).create(input, createdBy, organizationId);
        await createActivityLogRepo(tx).log({
          organizationId,
          userId: createdBy,
          action: "bill_created",
          entityType: "bill",
          entityId: bill.id,
          metadata: {
            vendorId: bill.vendorId,
            vendorName: bill.vendorName,
            amount: bill.amount,
            currency: bill.currency,
          },
        });
        return bill;
      });
    },

    /** Submits a draft bill for approval (draft → pending_approval). */
    async submitForApproval(
      id: string,
      organizationId: string,
      userId: string,
    ): Promise<BillDetail> {
      const bill = await repo.getById(id, organizationId);
      assertTransition(bill.status, "pending_approval");
      return db.transaction(async (tx) => {
        const updated = await createBillRepo(tx).updateStatus(
          id,
          organizationId,
          "pending_approval",
        );
        await createActivityLogRepo(tx).log({
          organizationId,
          userId,
          action: "bill_submitted",
          entityType: "bill",
          entityId: id,
        });
        return updated;
      });
    },

    /**
     * Demo-only: marks an approved/scheduled bill as paid. Real payment rails
     * are out of scope for this take-home; this just flips the status and logs.
     */
    async simulatePayment(
      id: string,
      organizationId: string,
      userId: string,
    ): Promise<BillDetail> {
      const bill = await repo.getById(id, organizationId);
      assertTransition(bill.status, "paid");
      return db.transaction(async (tx) => {
        const updated = await createBillRepo(tx).updateStatus(id, organizationId, "paid");
        await createActivityLogRepo(tx).log({
          organizationId,
          userId,
          action: "bill_paid",
          entityType: "bill",
          entityId: id,
          metadata: { simulated: true },
        });
        return updated;
      });
    },

    /** Demo-only: marks the bill as payment_failed. */
    async simulatePaymentFailure(
      id: string,
      organizationId: string,
      userId: string,
    ): Promise<BillDetail> {
      const bill = await repo.getById(id, organizationId);
      assertTransition(bill.status, "payment_failed");
      return db.transaction(async (tx) => {
        const updated = await createBillRepo(tx).updateStatus(
          id,
          organizationId,
          "payment_failed",
        );
        await createActivityLogRepo(tx).log({
          organizationId,
          userId,
          action: "bill_payment_failed",
          entityType: "bill",
          entityId: id,
          metadata: { simulated: true },
        });
        return updated;
      });
    },

    /** Deletes a bill. Only draft bills may be deleted. */
    async remove(id: string, organizationId: string, userId: string): Promise<void> {
      const bill = await repo.getById(id, organizationId); // throws NotFoundError if unknown
      if (bill.status !== "draft") {
        throw new ConflictError("Only draft bills can be deleted");
      }
      await db.transaction(async (tx) => {
        await createBillRepo(tx).delete(id, organizationId);
        await createActivityLogRepo(tx).log({
          organizationId,
          userId,
          action: "bill_deleted",
          entityType: "bill",
          entityId: id,
          metadata: { vendorId: bill.vendorId, vendorName: bill.vendorName },
        });
      });
    },
  };
}
