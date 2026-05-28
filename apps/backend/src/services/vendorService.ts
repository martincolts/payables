import type {
  CreateVendorInput,
  Paginated,
  PaginationQuery,
  Vendor,
} from "@payables/shared";
import type { DB } from "../db/client.js";
import { createVendorRepo } from "../repositories/vendorRepo.js";
import { createActivityLogRepo } from "../repositories/activityLogRepo.js";

export type VendorService = ReturnType<typeof createVendorService>;

/**
 * Vendor operations. Mutations are wrapped in a transaction with the matching
 * activity-log write so the audit trail and the data state can never diverge.
 */
export function createVendorService(db: DB) {
  const repo = createVendorRepo(db);

  return {
    async create(
      input: CreateVendorInput,
      organizationId: string,
      userId: string,
    ): Promise<Vendor> {
      return db.transaction(async (tx) => {
        const vendor = await createVendorRepo(tx).create(input, organizationId);
        await createActivityLogRepo(tx).log({
          organizationId,
          userId,
          action: "vendor_created",
          entityType: "vendor",
          entityId: vendor.id,
          metadata: { name: vendor.name, paymentMethod: vendor.paymentMethod },
        });
        return vendor;
      });
    },

    getById(id: string, organizationId: string): Promise<Vendor> {
      return repo.getById(id, organizationId);
    },

    /** Soft-deletes a vendor by marking it inactive. */
    async deactivate(
      id: string,
      organizationId: string,
      userId: string,
    ): Promise<Vendor> {
      return db.transaction(async (tx) => {
        const vendor = await createVendorRepo(tx).deactivate(id, organizationId);
        await createActivityLogRepo(tx).log({
          organizationId,
          userId,
          action: "vendor_deactivated",
          entityType: "vendor",
          entityId: vendor.id,
          metadata: { name: vendor.name },
        });
        return vendor;
      });
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
