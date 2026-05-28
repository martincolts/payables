import { useQuery } from "@tanstack/react-query";
import type { ActivityAction } from "@payables/shared";
import { api } from "../api/client";

export interface ActivityLogQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: ActivityAction;
  from?: string;
  to?: string;
}

export function useActivityLog(query: ActivityLogQuery = {}) {
  const { page = 1, pageSize = 20, userId, action, from, to } = query;
  return useQuery({
    queryKey: [
      "activity-log",
      page,
      pageSize,
      userId ?? null,
      action ?? null,
      from ?? null,
      to ?? null,
    ],
    queryFn: async () => {
      const res = await api.api["activity-log"].$get({
        query: {
          page: String(page),
          pageSize: String(pageSize),
          ...(userId ? { userId } : {}),
          ...(action ? { action } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      });
      if (!res.ok) throw new Error("Couldn't load activity log");
      return res.json();
    },
  });
}
