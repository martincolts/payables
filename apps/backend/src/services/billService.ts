import type { BillListItem, Paginated } from "@payables/shared";
import type { BillRepo, ListBillsParams } from "../repositories/billRepo.js";

export type BillService = ReturnType<typeof createBillService>;

export function createBillService(repo: BillRepo) {
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
  };
}
