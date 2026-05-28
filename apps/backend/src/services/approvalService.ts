import type { ApprovalSummary, SubmitApprovalInput } from "@payables/shared";
import type { ApprovalRepo } from "../repositories/approvalRepo.js";
import type { BillRepo } from "../repositories/billRepo.js";
import type { OrganizationRepo } from "../repositories/organizationRepo.js";
import { assertTransition } from "./billStateMachine.js";
import { ConflictError } from "../types/errors.js";

export type ApprovalService = ReturnType<typeof createApprovalService>;

export function createApprovalService(
  repo: ApprovalRepo,
  billRepo: BillRepo,
  orgRepo: OrganizationRepo,
) {
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
     * of distinct approvals moves it to `approved`.
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

      await repo.create({
        billId,
        approverId,
        status: input.decision === "approve" ? "approved" : "rejected",
        comment: input.comment ?? null,
      });

      if (input.decision === "reject") {
        assertTransition(bill.status, "rejected");
        await billRepo.updateStatus(billId, organizationId, "rejected");
      } else {
        const [org, approved] = await Promise.all([
          orgRepo.getById(organizationId),
          repo.countApproved(billId),
        ]);
        if (approved >= org.requiredApprovals) {
          assertTransition(bill.status, "approved");
          await billRepo.updateStatus(billId, organizationId, "approved");
        }
      }

      return summarize(billId, organizationId);
    },
  };
}
