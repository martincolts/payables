import type { BillListItem, CreateBillInput, Paginated } from "@payables/shared";
import type { BillRepo, ListBillsParams } from "../repositories/billRepo.js";
import type { VendorRepo } from "../repositories/vendorRepo.js";
import { assertTransition } from "./billStateMachine.js";
import { ConflictError } from "../types/errors.js";

export type BillService = ReturnType<typeof createBillService>;

export function createBillService(repo: BillRepo, vendorRepo: VendorRepo) {
  return {
    getById(id: string, organizationId: string): Promise<BillListItem> {
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
    ): Promise<BillListItem> {
      // Reject bills against unknown or deactivated vendors. getById throws
      // NotFoundError (→ 404) when the vendor doesn't exist.
      const vendor = await vendorRepo.getById(input.vendorId, organizationId);
      if (!vendor.isActive) {
        throw new ConflictError("Cannot create a bill for a deactivated vendor");
      }
      return repo.create(input, createdBy, organizationId);
    },

    /** Submits a draft bill for approval (draft → pending_approval). */
    async submitForApproval(id: string, organizationId: string): Promise<BillListItem> {
      const bill = await repo.getById(id, organizationId);
      assertTransition(bill.status, "pending_approval");
      return repo.updateStatus(id, organizationId, "pending_approval");
    },

    /** Deletes a bill. Only draft bills may be deleted. */
    async remove(id: string, organizationId: string): Promise<void> {
      const bill = await repo.getById(id, organizationId); // throws NotFoundError if unknown
      if (bill.status !== "draft") {
        throw new ConflictError("Only draft bills can be deleted");
      }
      await repo.delete(id, organizationId);
    },
  };
}
