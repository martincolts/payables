import type {
  CreateVendorInput,
  Paginated,
  PaginationQuery,
  Vendor,
} from "@payables/shared";
import type { VendorRepo } from "../repositories/vendorRepo.js";

export type VendorService = ReturnType<typeof createVendorService>;

export function createVendorService(repo: VendorRepo) {
  return {
    create(input: CreateVendorInput): Promise<Vendor> {
      return repo.create(input);
    },

    getById(id: string): Promise<Vendor> {
      return repo.getById(id);
    },

    async list(query: PaginationQuery): Promise<Paginated<Vendor>> {
      const { items, total } = await repo.list(query);
      return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    },
  };
}
