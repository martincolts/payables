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
    create(input: CreateVendorInput, organizationId: string): Promise<Vendor> {
      return repo.create(input, organizationId);
    },

    getById(id: string, organizationId: string): Promise<Vendor> {
      return repo.getById(id, organizationId);
    },

    /** Soft-deletes a vendor by marking it inactive. */
    deactivate(id: string, organizationId: string): Promise<Vendor> {
      return repo.deactivate(id, organizationId);
    },

    async list(organizationId: string, query: PaginationQuery): Promise<Paginated<Vendor>> {
      const { items, total } = await repo.list(organizationId, query);
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
