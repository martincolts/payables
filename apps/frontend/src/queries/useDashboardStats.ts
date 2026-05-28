import { useQuery } from "@tanstack/react-query";
import type { MonthKey } from "@payables/shared";
import { api } from "../api/client";

export type StatsWindow = { from: MonthKey; to: MonthKey };

export function useDashboardStats(window: StatsWindow) {
  return useQuery({
    queryKey: ["stats", "dashboard", window.from, window.to],
    queryFn: async () => {
      const res = await api.api.stats.dashboard.$get({
        query: { from: window.from, to: window.to },
      });
      if (!res.ok) throw new Error("Couldn't load stats");
      return res.json();
    },
  });
}
