import type {
  ActivityLogEntry,
  ListActivityLogQuery,
  Paginated,
} from "@payables/shared";
import type { ActivityLogRepo } from "../repositories/activityLogRepo.js";

export type ActivityLogService = ReturnType<typeof createActivityLogService>;

export function createActivityLogService(repo: ActivityLogRepo) {
  return {
    async list(
      organizationId: string,
      query: ListActivityLogQuery,
    ): Promise<Paginated<ActivityLogEntry>> {
      const { items, total } = await repo.list({ ...query, organizationId });
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
