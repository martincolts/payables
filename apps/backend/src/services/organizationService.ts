import type {
  Member,
  Organization,
  Paginated,
  PaginationQuery,
  UpdateOrganizationInput,
} from "@payables/shared";
import type { OrganizationRepo } from "../repositories/organizationRepo.js";
import type { UserRepo } from "../repositories/userRepo.js";

export type OrganizationService = ReturnType<typeof createOrganizationService>;

export function createOrganizationService(repo: OrganizationRepo, userRepo: UserRepo) {
  return {
    get(organizationId: string): Promise<Organization> {
      return repo.getById(organizationId);
    },

    update(
      organizationId: string,
      patch: UpdateOrganizationInput,
    ): Promise<Organization> {
      return repo.update(organizationId, patch);
    },

    /** Lists the organization's members (the team). */
    async listMembers(
      organizationId: string,
      params: PaginationQuery,
    ): Promise<Paginated<Member>> {
      const { items, total } = await userRepo.list(organizationId, params);
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
