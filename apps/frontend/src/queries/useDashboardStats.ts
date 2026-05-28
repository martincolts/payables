import { useQuery } from "@tanstack/react-query";
import type { BillStatus, MonthKey } from "@payables/shared";
import { api } from "../api/client";

export type StatsWindow = { from: MonthKey; to: MonthKey };

export function useDashboardStats(window: StatsWindow, statuses: BillStatus[] = []) {
  const statusesParam = statuses.length > 0 ? [...statuses].sort().join(",") : undefined;
  return useQuery({
    queryKey: ["stats", "dashboard", window.from, window.to, statusesParam ?? ""],
    queryFn: async () => {
      const res = await api.api.stats.dashboard.$get({
        query: {
          from: window.from,
          to: window.to,
          ...(statusesParam ? { statuses: statusesParam } : {}),
        },
      });
      if (!res.ok) throw new Error("Couldn't load stats");
      return res.json();
    },
  });
}
