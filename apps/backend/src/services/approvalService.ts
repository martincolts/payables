import type { ApprovalSummary, SubmitApprovalInput } from "@payables/shared";
import type { DB } from "../db/client.js";
import { createApprovalRepo, type ApprovalRepo } from "../repositories/approvalRepo.js";
import { createBillRepo, type BillRepo } from "../repositories/billRepo.js";
import type { OrganizationRepo } from "../repositories/organizationRepo.js";
import { createActivityLogRepo } from "../repositories/activityLogRepo.js";
import { assertTransition } from "./billStateMachine.js";
import { ConflictError } from "../types/errors.js";

export type ApprovalService = ReturnType<typeof createApprovalService>;

/**
 * Approval operations. `submitDecision` records the vote and any resulting
 * status flip inside a single transaction with the matching activity-log
 * entry, so the audit trail and the bill state advance atomically.
 */
export function createApprovalService(db: DB, orgRepo: OrganizationRepo) {
  const repo: ApprovalRepo = createApprovalRepo(db);
  const billRepo: BillRepo = createBillRepo(db);

  async function summarize(
    billId: string,
    organizationId: string,
  ): Promise<ApprovalSummary> {
    const [org, decisions, approved] = await Promise.all([
      orgRepo.getById(organizationId),
      repo.listByBill(billId),
      repo.countApproved(billId),
    ]);
    return { billId, required: org.requiredApprovals, approved, decisions };
  }

  return {
    /** Lists a bill's approval decisions and quorum progress. */
    async getSummary(billId: string, organizationId: string): Promise<ApprovalSummary> {
      await billRepo.getById(billId, organizationId); // 404 if not in org
      return summarize(billId, organizationId);
    },

    /**
     * Records an approver's decision and advances the bill when warranted:
     * any rejection moves it to `rejected`; reaching the org's required count
     * of distinct approvals moves it to `approved`. The decision, the status
     * change (if any), and the activity-log entry all share one transaction.
     */
    async submitDecision(
      billId: string,
      organizationId: string,
      approverId: string,
      input: SubmitApprovalInput,
    ): Promise<ApprovalSummary> {
      const bill = await billRepo.getById(billId, organizationId); // 404 if not in org
      if (bill.status !== "pending_approval") {
        throw new ConflictError("This bill is not awaiting approval");
      }

      await db.transaction(async (tx) => {
        const txApprovals = createApprovalRepo(tx);
        const txBills = createBillRepo(tx);
        const txLog = createActivityLogRepo(tx);

        await txApprovals.create({
          billId,
          approverId,
          status: input.decision === "approve" ? "approved" : "rejected",
          comment: input.comment ?? null,
        });

        if (input.decision === "reject") {
          assertTransition(bill.status, "rejected");
          await txBills.updateStatus(billId, organizationId, "rejected");
          await txLog.log({
            organizationId,
            userId: approverId,
            action: "bill_rejected",
            entityType: "bill",
            entityId: billId,
            metadata: input.comment ? { comment: input.comment } : null,
          });
        } else {
          const [org, approved] = await Promise.all([
            orgRepo.getById(organizationId),
            txApprovals.countApproved(billId),
          ]);
          if (approved >= org.requiredApprovals) {
            assertTransition(bill.status, "approved");
            await txBills.updateStatus(billId, organizationId, "approved");
          }
          await txLog.log({
            organizationId,
            userId: approverId,
            action: "bill_approved",
            entityType: "bill",
            entityId: billId,
            metadata: input.comment ? { comment: input.comment } : null,
          });
        }
      });

      return summarize(billId, organizationId);
    },
  };
}
