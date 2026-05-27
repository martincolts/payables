import type { BillListItem, CreateBillInput, Paginated } from "@payables/shared";
import type { BillRepo, ListBillsParams } from "../repositories/billRepo.js";
import type { VendorRepo } from "../repositories/vendorRepo.js";
import { ConflictError } from "../types/errors.js";

export type BillService = ReturnType<typeof createBillService>;

export function createBillService(repo: BillRepo, vendorRepo: VendorRepo) {
  return {
    getById(id: string): Promise<BillListItem> {
      return repo.getById(id);
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

    async create(input: CreateBillInput, createdBy: string): Promise<BillListItem> {
      // Reject bills against unknown or deactivated vendors. getById throws
      // NotFoundError (→ 404) when the vendor doesn't exist.
      const vendor = await vendorRepo.getById(input.vendorId);
      if (!vendor.isActive) {
        throw new ConflictError("Cannot create a bill for a deactivated vendor");
      }
      return repo.create(input, createdBy);
    },

    /** Deletes a bill. Only draft bills may be deleted. */
    async remove(id: string): Promise<void> {
      const bill = await repo.getById(id); // throws NotFoundError if unknown
      if (bill.status !== "draft") {
        throw new ConflictError("Only draft bills can be deleted");
      }
      await repo.delete(id);
    },
  };
}
